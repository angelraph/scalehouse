// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ScaleTicket
/// @notice An evidence-locked payment ticket. A ticket pays once, to the payee bound when it
///         was cut, for the quantity a second witness confirmed, at the price that was posted —
///         or it does not pay at all, and says why in public.
///
///         The agent that calls `release` decides *when* and *whether* to pay. It never decides
///         *how much* or *to whom*: the contract recomputes the amount and checks the payee
///         itself. A disagreement between the agent and the rule freezes the ticket instead of
///         being rounded, rewritten, or quietly paid.
///
///         Non-custodial: this contract never holds funds. A house owner keeps their stablecoin
///         in their own wallet and grants this contract an allowance; `release` moves money
///         straight from the owner to the payee.
contract ScaleTicket is EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// Quantities carry three decimals: 1500 = 1.5 kg / hours / units.
    uint256 public constant QTY_SCALE = 1000;
    uint16 public constant MAX_QTY_TOLERANCE_BPS = 2000; // 20%
    uint16 public constant MAX_LEVY_BPS = 1000; // 10%

    uint8 public constant ROLE_ISSUER = 1;
    uint8 public constant ROLE_WITNESS = 2;

    bytes32 public constant CONFIRM_TYPEHASH = keccak256(
        "Confirm(uint256 ticketId,uint64 observedQuantity,address payee,bytes32 evidenceHash,uint256 deadline)"
    );

    enum Status {
        None,
        Open,
        Confirmed,
        Paid,
        Frozen,
        Voided
    }

    enum Reason {
        None,
        // Refusals: the ticket is untouched and may be released later.
        NotConfirmed,
        AlreadyPaid,
        TicketFrozen,
        TicketVoided,
        Paused,
        OverTicketCap,
        OverPayeeCap,
        OverDailyCap,
        InsufficientFloat,
        // Freezes: the ticket is locked until the house owner reviews it.
        QuantityMismatch,
        AmountMismatch,
        PayeeMismatch
    }

    struct House {
        address owner;
        address pendingOwner;
        address agent;
        IERC20 token;
        uint128 maxTicket;
        uint128 dailyCap;
        uint16 quantityToleranceBps;
        uint16 levyBps;
        address levyRecipient;
        bool paused;
    }

    struct Rate {
        uint128 unitPrice; // token base units per 1 whole unit
        uint64 validUntil;
        bool active;
    }

    struct Ticket {
        uint256 houseId;
        address issuer;
        address payee;
        address witness;
        bytes32 rateId;
        bytes32 evidenceHash;
        uint128 unitPrice;
        uint64 quantity;
        uint64 confirmedQuantity;
        uint64 cutAt;
        uint64 settledAt;
        Status status;
    }

    struct PayeeCap {
        uint128 cap;
        bool set;
    }

    uint256 public houseCount;
    uint256 public ticketCount;

    mapping(uint256 => House) public houses;
    mapping(uint256 => mapping(bytes32 => Rate)) public rates;
    mapping(uint256 => mapping(address => uint8)) public roles;
    mapping(uint256 => mapping(address => PayeeCap)) public payeeCaps;
    mapping(uint256 => mapping(bytes32 => uint256)) public evidenceTicket; // evidence -> ticket id
    mapping(uint256 => mapping(uint256 => uint256)) public spentOnDay; // house -> day -> gross
    mapping(uint256 => Ticket) public tickets;

    event HouseCreated(uint256 indexed houseId, address indexed owner, address token, string name);
    event HouseOwnershipOffered(uint256 indexed houseId, address indexed to);
    event HouseOwnershipAccepted(uint256 indexed houseId, address indexed owner);
    event AgentSet(uint256 indexed houseId, address indexed agent);
    event RolesSet(uint256 indexed houseId, address indexed who, uint8 roles);
    event RateSet(uint256 indexed houseId, bytes32 indexed rateId, uint128 unitPrice, uint64 validUntil, bool active, string label);
    event LimitsSet(uint256 indexed houseId, uint128 maxTicket, uint128 dailyCap, uint16 quantityToleranceBps);
    event LevySet(uint256 indexed houseId, uint16 levyBps, address recipient);
    event HousePaused(uint256 indexed houseId, bool paused);
    event PayeeCapSet(uint256 indexed houseId, address indexed payee, uint128 cap, address indexed by, bytes32 rationaleHash);

    event TicketCut(
        uint256 indexed ticketId,
        uint256 indexed houseId,
        address indexed payee,
        address issuer,
        bytes32 rateId,
        uint64 quantity,
        uint128 unitPrice,
        bytes32 evidenceHash
    );
    event TicketConfirmed(uint256 indexed ticketId, uint256 indexed houseId, address indexed witness, uint64 observedQuantity, uint64 confirmedQuantity);
    event TicketFrozen(uint256 indexed ticketId, uint256 indexed houseId, Reason reason, address by, bytes32 rationaleHash);
    event ReleaseRefused(uint256 indexed ticketId, uint256 indexed houseId, Reason reason, bytes32 rationaleHash);
    event TicketReleased(
        uint256 indexed ticketId,
        uint256 indexed houseId,
        address indexed payee,
        uint256 gross,
        uint256 levy,
        bytes32 rationaleHash
    );
    event TicketReopened(uint256 indexed ticketId, uint256 indexed houseId, bytes32 reasonHash);
    event TicketVoided(uint256 indexed ticketId, uint256 indexed houseId, bytes32 reasonHash);
    event AgentDecision(uint256 indexed houseId, uint256 indexed ticketId, bytes32 indexed kind, bytes32 rationaleHash);

    error UnknownHouse();
    error UnknownTicket();
    error NotHouseOwner();
    error NotPendingOwner();
    error NotAgent();
    error NotIssuer();
    error NotWitness();
    error WitnessConflict();
    error RoleConflict();
    error HouseIsPaused();
    error BadPayee();
    error BadQuantity();
    error BadEvidence();
    error DuplicateEvidence(uint256 existingTicketId);
    error RateUnavailable();
    error OverTicketCap();
    error BadLimits();
    error BadLevy();
    error BadStatus();
    error CapNotLowered();
    error SignatureExpired();
    error BadSignature();
    error ZeroAddress();

    constructor(address protocolAdmin) EIP712("ScaleTicket", "1") Ownable(protocolAdmin) {}

    // ---------------------------------------------------------------- houses

    modifier onlyHouseOwner(uint256 houseId) {
        if (houses[houseId].owner != msg.sender) revert NotHouseOwner();
        _;
    }

    /// @notice Opens a house. The caller becomes its owner and the wallet it pays from.
    function createHouse(
        IERC20 token,
        string calldata name,
        uint128 maxTicket,
        uint128 dailyCap,
        uint16 quantityToleranceBps
    ) external returns (uint256 houseId) {
        if (address(token) == address(0)) revert ZeroAddress();
        _checkLimits(maxTicket, dailyCap, quantityToleranceBps);

        houseId = ++houseCount;
        House storage h = houses[houseId];
        h.owner = msg.sender;
        h.token = token;
        h.maxTicket = maxTicket;
        h.dailyCap = dailyCap;
        h.quantityToleranceBps = quantityToleranceBps;

        emit HouseCreated(houseId, msg.sender, address(token), name);
        emit LimitsSet(houseId, maxTicket, dailyCap, quantityToleranceBps);
    }

    /// @notice Ownership moves in two steps so a house can never be pointed at a wallet that
    ///         did not agree to pay for it.
    function offerHouse(uint256 houseId, address to) external onlyHouseOwner(houseId) {
        houses[houseId].pendingOwner = to;
        emit HouseOwnershipOffered(houseId, to);
    }

    function acceptHouse(uint256 houseId) external {
        House storage h = houses[houseId];
        if (h.pendingOwner != msg.sender) revert NotPendingOwner();
        h.owner = msg.sender;
        h.pendingOwner = address(0);
        emit HouseOwnershipAccepted(houseId, msg.sender);
    }

    function setAgent(uint256 houseId, address agent) external onlyHouseOwner(houseId) {
        if (roles[houseId][agent] != 0) revert RoleConflict();
        houses[houseId].agent = agent;
        emit AgentSet(houseId, agent);
    }

    function setRoles(uint256 houseId, address who, uint8 newRoles) external onlyHouseOwner(houseId) {
        if (who == address(0)) revert ZeroAddress();
        if (newRoles != 0 && who == houses[houseId].agent) revert RoleConflict();
        roles[houseId][who] = newRoles & (ROLE_ISSUER | ROLE_WITNESS);
        emit RolesSet(houseId, who, roles[houseId][who]);
    }

    function setRate(
        uint256 houseId,
        bytes32 rateId,
        uint128 unitPrice,
        uint64 validUntil,
        bool active,
        string calldata label
    ) external onlyHouseOwner(houseId) {
        rates[houseId][rateId] = Rate(unitPrice, validUntil, active);
        emit RateSet(houseId, rateId, unitPrice, validUntil, active, label);
    }

    function setLimits(uint256 houseId, uint128 maxTicket, uint128 dailyCap, uint16 quantityToleranceBps)
        external
        onlyHouseOwner(houseId)
    {
        _checkLimits(maxTicket, dailyCap, quantityToleranceBps);
        House storage h = houses[houseId];
        h.maxTicket = maxTicket;
        h.dailyCap = dailyCap;
        h.quantityToleranceBps = quantityToleranceBps;
        emit LimitsSet(houseId, maxTicket, dailyCap, quantityToleranceBps);
    }

    function setLevy(uint256 houseId, uint16 levyBps, address recipient) external onlyHouseOwner(houseId) {
        if (levyBps > MAX_LEVY_BPS || (levyBps > 0 && recipient == address(0))) revert BadLevy();
        houses[houseId].levyBps = levyBps;
        houses[houseId].levyRecipient = recipient;
        emit LevySet(houseId, levyBps, recipient);
    }

    function setHousePaused(uint256 houseId, bool paused_) external onlyHouseOwner(houseId) {
        houses[houseId].paused = paused_;
        emit HousePaused(houseId, paused_);
    }

    /// @notice A per-counterparty ceiling. The owner may set any value; the agent may only
    ///         lower it. A riskier counterparty gets a smaller ticket, not a silent ban.
    function setPayeeCap(uint256 houseId, address payee, uint128 cap, bytes32 rationaleHash) external {
        House storage h = houses[houseId];
        if (h.owner == address(0)) revert UnknownHouse();
        if (msg.sender != h.owner) {
            if (msg.sender != h.agent) revert NotAgent();
            if (cap > effectivePayeeCap(houseId, payee)) revert CapNotLowered();
        }
        payeeCaps[houseId][payee] = PayeeCap(cap, true);
        emit PayeeCapSet(houseId, payee, cap, msg.sender, rationaleHash);
    }

    // ---------------------------------------------------------------- tickets

    /// @notice Cuts a ticket. The payee and the price are bound here and cannot change.
    /// @param evidenceHash Hash of the delivery note / invoice / scale photo. One piece of
    ///        evidence can back only one live ticket per house, so the same invoice cannot be
    ///        presented twice.
    function cut(uint256 houseId, address payee, bytes32 rateId, uint64 quantity, bytes32 evidenceHash)
        external
        returns (uint256 ticketId)
    {
        House storage h = houses[houseId];
        if (h.owner == address(0)) revert UnknownHouse();
        if (h.paused || paused()) revert HouseIsPaused();
        if (roles[houseId][msg.sender] & ROLE_ISSUER == 0) revert NotIssuer();
        if (payee == address(0) || payee == h.owner || payee == h.agent) revert BadPayee();
        if (quantity == 0) revert BadQuantity();
        if (evidenceHash == bytes32(0)) revert BadEvidence();
        uint256 existing = evidenceTicket[houseId][evidenceHash];
        if (existing != 0) revert DuplicateEvidence(existing);

        Rate memory r = rates[houseId][rateId];
        if (!r.active || r.unitPrice == 0 || block.timestamp > r.validUntil) revert RateUnavailable();
        uint256 claimedGross = _gross(quantity, r.unitPrice);
        if (claimedGross == 0) revert BadQuantity();
        if (claimedGross > h.maxTicket) revert OverTicketCap();

        ticketId = ++ticketCount;
        evidenceTicket[houseId][evidenceHash] = ticketId;
        tickets[ticketId] = Ticket({
            houseId: houseId,
            issuer: msg.sender,
            payee: payee,
            witness: address(0),
            rateId: rateId,
            evidenceHash: evidenceHash,
            unitPrice: r.unitPrice,
            quantity: quantity,
            confirmedQuantity: 0,
            cutAt: uint64(block.timestamp),
            settledAt: 0,
            status: Status.Open
        });

        emit TicketCut(ticketId, houseId, payee, msg.sender, rateId, quantity, r.unitPrice, evidenceHash);
    }

    /// @notice The second witness reports the quantity they observed. Within tolerance the
    ///         ticket is confirmed at the lower of the two readings; outside it, it freezes.
    function confirm(uint256 ticketId, uint64 observedQuantity) external {
        _confirm(ticketId, msg.sender, observedQuantity);
    }

    /// @notice Same as `confirm`, signed off-chain so a witness never needs gas.
    function confirmBySig(
        uint256 ticketId,
        uint64 observedQuantity,
        address witness,
        uint256 deadline,
        bytes calldata signature
    ) external {
        if (block.timestamp > deadline) revert SignatureExpired();
        Ticket storage t = tickets[ticketId];
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(CONFIRM_TYPEHASH, ticketId, observedQuantity, t.payee, t.evidenceHash, deadline))
        );
        if (!SignatureChecker.isValidSignatureNow(witness, digest, signature)) revert BadSignature();
        _confirm(ticketId, witness, observedQuantity);
    }

    /// @notice The agent asks for a ticket to be paid. It must name the payee and amount it
    ///         believes are right; the contract pays only if both match its own reading.
    ///         Rule violations never revert: they emit a public refusal or freeze.
    function release(uint256 ticketId, address payee, uint256 amount, bytes32 rationaleHash)
        external
        nonReentrant
        returns (bool paid, Reason reason)
    {
        Ticket storage t = tickets[ticketId];
        if (t.status == Status.None) revert UnknownTicket();
        uint256 houseId = t.houseId;
        House storage h = houses[houseId];
        if (msg.sender != h.agent) revert NotAgent();

        reason = _releaseCheck(t, h, houseId, payee, amount);
        if (reason != Reason.None) {
            if (reason == Reason.AmountMismatch || reason == Reason.PayeeMismatch) {
                t.status = Status.Frozen;
                emit TicketFrozen(ticketId, houseId, reason, msg.sender, rationaleHash);
            } else {
                emit ReleaseRefused(ticketId, houseId, reason, rationaleHash);
            }
            return (false, reason);
        }

        uint256 gross = _gross(t.confirmedQuantity, t.unitPrice);
        uint256 levy = (gross * h.levyBps) / 10_000;

        t.status = Status.Paid;
        t.settledAt = uint64(block.timestamp);
        spentOnDay[houseId][block.timestamp / 1 days] += gross;

        h.token.safeTransferFrom(h.owner, t.payee, gross - levy);
        if (levy > 0) h.token.safeTransferFrom(h.owner, h.levyRecipient, levy);

        emit TicketReleased(ticketId, houseId, t.payee, gross, levy, rationaleHash);
        return (true, Reason.None);
    }

    /// @notice Records an agent decision that moved no money (deferring a payment, chasing a
    ///         debtor, re-screening a counterparty) so the audit trail has no gaps.
    function logDecision(uint256 houseId, uint256 ticketId, bytes32 kind, bytes32 rationaleHash) external {
        if (msg.sender != houses[houseId].agent || msg.sender == address(0)) revert NotAgent();
        emit AgentDecision(houseId, ticketId, kind, rationaleHash);
    }

    /// @notice Owner review of a frozen ticket: send it back for a fresh witness reading.
    function reopen(uint256 ticketId, bytes32 reasonHash) external {
        Ticket storage t = tickets[ticketId];
        if (houses[t.houseId].owner != msg.sender) revert NotHouseOwner();
        if (t.status != Status.Frozen) revert BadStatus();
        t.status = Status.Open;
        t.witness = address(0);
        t.confirmedQuantity = 0;
        emit TicketReopened(ticketId, t.houseId, reasonHash);
    }

    /// @notice Owner cancels an unpaid ticket. Its evidence is freed so a corrected ticket can
    ///         be cut against the same document.
    function voidTicket(uint256 ticketId, bytes32 reasonHash) external {
        Ticket storage t = tickets[ticketId];
        if (houses[t.houseId].owner != msg.sender) revert NotHouseOwner();
        if (t.status != Status.Open && t.status != Status.Confirmed && t.status != Status.Frozen) revert BadStatus();
        t.status = Status.Voided;
        delete evidenceTicket[t.houseId][t.evidenceHash];
        emit TicketVoided(ticketId, t.houseId, reasonHash);
    }

    // ---------------------------------------------------------------- protocol

    /// @notice Emergency stop. The protocol admin can halt releases; it cannot move funds.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------- views

    function grossOf(uint256 ticketId) external view returns (uint256) {
        Ticket storage t = tickets[ticketId];
        uint64 q = t.confirmedQuantity == 0 ? t.quantity : t.confirmedQuantity;
        return _gross(q, t.unitPrice);
    }

    function spentToday(uint256 houseId) external view returns (uint256) {
        return spentOnDay[houseId][block.timestamp / 1 days];
    }

    function effectivePayeeCap(uint256 houseId, address payee) public view returns (uint128) {
        PayeeCap memory c = payeeCaps[houseId][payee];
        return c.set ? c.cap : houses[houseId].maxTicket;
    }

    function confirmDigest(uint256 ticketId, uint64 observedQuantity, uint256 deadline) external view returns (bytes32) {
        Ticket storage t = tickets[ticketId];
        return _hashTypedDataV4(
            keccak256(abi.encode(CONFIRM_TYPEHASH, ticketId, observedQuantity, t.payee, t.evidenceHash, deadline))
        );
    }

    // ---------------------------------------------------------------- internals

    function _confirm(uint256 ticketId, address witness, uint64 observed) internal {
        Ticket storage t = tickets[ticketId];
        if (t.status == Status.None) revert UnknownTicket();
        if (t.status != Status.Open) revert BadStatus();
        uint256 houseId = t.houseId;
        House storage h = houses[houseId];
        if (roles[houseId][witness] & ROLE_WITNESS == 0) revert NotWitness();
        if (witness == t.issuer || witness == t.payee || witness == h.agent) revert WitnessConflict();

        t.witness = witness;
        uint256 claimed = t.quantity;
        uint256 diff = observed > claimed ? observed - claimed : claimed - observed;
        if (observed == 0 || diff * 10_000 > claimed * h.quantityToleranceBps) {
            t.confirmedQuantity = observed;
            t.status = Status.Frozen;
            emit TicketConfirmed(ticketId, houseId, witness, observed, 0);
            emit TicketFrozen(ticketId, houseId, Reason.QuantityMismatch, witness, bytes32(0));
            return;
        }

        t.confirmedQuantity = observed < t.quantity ? observed : t.quantity;
        t.status = Status.Confirmed;
        emit TicketConfirmed(ticketId, houseId, witness, observed, t.confirmedQuantity);
    }

    function _releaseCheck(Ticket storage t, House storage h, uint256 houseId, address payee, uint256 amount)
        internal
        view
        returns (Reason)
    {
        if (t.status == Status.Paid) return Reason.AlreadyPaid;
        if (t.status == Status.Frozen) return Reason.TicketFrozen;
        if (t.status == Status.Voided) return Reason.TicketVoided;
        if (t.status != Status.Confirmed) return Reason.NotConfirmed;
        if (paused() || h.paused) return Reason.Paused;

        uint256 gross = _gross(t.confirmedQuantity, t.unitPrice);
        if (payee != t.payee) return Reason.PayeeMismatch;
        if (amount != gross) return Reason.AmountMismatch;
        if (gross > h.maxTicket) return Reason.OverTicketCap;
        if (gross > effectivePayeeCap(houseId, t.payee)) return Reason.OverPayeeCap;
        if (spentOnDay[houseId][block.timestamp / 1 days] + gross > h.dailyCap) return Reason.OverDailyCap;
        if (h.token.balanceOf(h.owner) < gross || h.token.allowance(h.owner, address(this)) < gross) {
            return Reason.InsufficientFloat;
        }
        return Reason.None;
    }

    function _gross(uint256 quantity, uint256 unitPrice) internal pure returns (uint256) {
        return (quantity * unitPrice) / QTY_SCALE;
    }

    function _checkLimits(uint128 maxTicket, uint128 dailyCap, uint16 tol) internal pure {
        if (maxTicket == 0 || dailyCap < maxTicket || tol > MAX_QTY_TOLERANCE_BPS) revert BadLimits();
    }
}
