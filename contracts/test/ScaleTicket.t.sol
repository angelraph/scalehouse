// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ScaleTicket} from "../src/ScaleTicket.sol";

contract TestUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ScaleTicketTest is Test {
    ScaleTicket st;
    TestUSDC usdc;

    address admin = makeAddr("admin");
    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address clerk = makeAddr("clerk");
    address supplier = makeAddr("supplier");
    address other = makeAddr("other");
    address witness;
    uint256 witnessKey;

    uint256 house;
    bytes32 constant RICE = keccak256("rice-bag");
    uint128 constant PRICE = 2_000_000; // $2.00 per bag
    uint128 constant MAX_TICKET = 50_000_000; // $50
    uint128 constant DAILY_CAP = 100_000_000; // $100

    function setUp() public {
        (witness, witnessKey) = makeAddrAndKey("witness");
        st = new ScaleTicket(admin);
        usdc = new TestUSDC();
        usdc.mint(owner, 1_000_000_000);

        vm.startPrank(owner);
        house = st.createHouse(IERC20(address(usdc)), "Mama Ada Provisions", MAX_TICKET, DAILY_CAP, 200); // 2%
        st.setAgent(house, agent);
        st.setRoles(house, clerk, st.ROLE_ISSUER());
        st.setRoles(house, witness, st.ROLE_WITNESS());
        st.setRate(house, RICE, PRICE, uint64(block.timestamp + 30 days), true, "Rice, 50kg bag");
        usdc.approve(address(st), type(uint256).max);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ helpers

    function _cut(uint64 qty, bytes32 evidence) internal returns (uint256 id) {
        vm.prank(clerk);
        id = st.cut(house, supplier, RICE, qty, evidence);
    }

    function _confirmed(uint64 qty) internal returns (uint256 id) {
        id = _cut(qty, keccak256(abi.encode("delivery", qty, st.ticketCount())));
        vm.prank(witness);
        st.confirm(id, qty);
    }

    function _status(uint256 id) internal view returns (ScaleTicket.Status s) {
        (,,,,,,,,,,, s) = st.tickets(id);
    }

    // ------------------------------------------------------------ happy path

    function test_cleanTicketPaysOnceToBoundPayee() public {
        uint256 id = _confirmed(10_000); // 10 bags
        uint256 gross = 20_000_000;
        assertEq(st.grossOf(id), gross);

        vm.prank(agent);
        (bool paid, ScaleTicket.Reason reason) = st.release(id, supplier, gross, keccak256("why"));

        assertTrue(paid);
        assertEq(uint8(reason), uint8(ScaleTicket.Reason.None));
        assertEq(usdc.balanceOf(supplier), gross);
        assertEq(uint8(_status(id)), uint8(ScaleTicket.Status.Paid));
        assertEq(st.spentToday(house), gross);
        assertEq(usdc.balanceOf(address(st)), 0, "contract never holds funds");
    }

    function test_levyIsSplitFromGross() public {
        address levyWallet = makeAddr("levy");
        vm.prank(owner);
        st.setLevy(house, 100, levyWallet); // 1%
        uint256 id = _confirmed(10_000);

        vm.prank(agent);
        st.release(id, supplier, 20_000_000, bytes32(0));

        assertEq(usdc.balanceOf(levyWallet), 200_000);
        assertEq(usdc.balanceOf(supplier), 19_800_000);
    }

    function test_confirmBySigLetsWitnessSkipGas() public {
        uint256 id = _cut(5_000, keccak256("note-1"));
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest = st.confirmDigest(id, 5_000, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(witnessKey, digest);

        vm.prank(other); // anyone may relay
        st.confirmBySig(id, 5_000, witness, deadline, abi.encodePacked(r, s, v));
        assertEq(uint8(_status(id)), uint8(ScaleTicket.Status.Confirmed));
    }

    // ------------------------------------------------------------ the refusals

    function test_duplicateReleaseIsRefusedInPublic() public {
        uint256 id = _confirmed(10_000);
        vm.startPrank(agent);
        st.release(id, supplier, 20_000_000, bytes32(0));

        vm.expectEmit(true, true, false, true);
        emit ScaleTicket.ReleaseRefused(id, house, ScaleTicket.Reason.AlreadyPaid, keccak256("retry"));
        (bool paid, ScaleTicket.Reason reason) = st.release(id, supplier, 20_000_000, keccak256("retry"));
        vm.stopPrank();

        assertFalse(paid);
        assertEq(uint8(reason), uint8(ScaleTicket.Reason.AlreadyPaid));
        assertEq(usdc.balanceOf(supplier), 20_000_000, "paid exactly once");
    }

    function test_duplicateEvidenceCannotBeTicketedTwice() public {
        uint256 first = _cut(1_000, keccak256("invoice-77"));
        vm.prank(clerk);
        vm.expectRevert(abi.encodeWithSelector(ScaleTicket.DuplicateEvidence.selector, first));
        st.cut(house, supplier, RICE, 1_000, keccak256("invoice-77"));
    }

    function test_agentNamingDifferentWalletFreezesTicket() public {
        uint256 id = _confirmed(10_000);
        vm.prank(agent);
        (bool paid, ScaleTicket.Reason reason) = st.release(id, other, 20_000_000, bytes32(0));

        assertFalse(paid);
        assertEq(uint8(reason), uint8(ScaleTicket.Reason.PayeeMismatch));
        assertEq(uint8(_status(id)), uint8(ScaleTicket.Status.Frozen));
        assertEq(usdc.balanceOf(other), 0);
        assertEq(usdc.balanceOf(supplier), 0);
    }

    function test_agentNamingWrongAmountFreezesTicket() public {
        uint256 id = _confirmed(10_000);
        vm.prank(agent);
        (bool paid, ScaleTicket.Reason reason) = st.release(id, supplier, 20_000_001, bytes32(0));

        assertFalse(paid);
        assertEq(uint8(reason), uint8(ScaleTicket.Reason.AmountMismatch));
        assertEq(uint8(_status(id)), uint8(ScaleTicket.Status.Frozen));
        assertEq(usdc.balanceOf(supplier), 0);
    }

    function test_witnessReadingOutsideToleranceFreezes() public {
        uint256 id = _cut(10_000, keccak256("note-2"));
        vm.prank(witness);
        st.confirm(id, 9_700); // 3% short, tolerance is 2%
        assertEq(uint8(_status(id)), uint8(ScaleTicket.Status.Frozen));

        vm.prank(agent);
        (bool paid, ScaleTicket.Reason reason) = st.release(id, supplier, 19_400_000, bytes32(0));
        assertFalse(paid);
        assertEq(uint8(reason), uint8(ScaleTicket.Reason.TicketFrozen));
    }

    function test_witnessReadingInsideTolerancePaysTheLowerQuantity() public {
        uint256 id = _cut(10_000, keccak256("note-3"));
        vm.prank(witness);
        st.confirm(id, 9_900); // 1% short
        assertEq(st.grossOf(id), 19_800_000);

        vm.prank(agent);
        (bool paid,) = st.release(id, supplier, 19_800_000, bytes32(0));
        assertTrue(paid);
    }

    function test_unwitnessedTicketIsRefused() public {
        uint256 id = _cut(1_000, keccak256("note-4"));
        vm.prank(agent);
        (bool paid, ScaleTicket.Reason reason) = st.release(id, supplier, 2_000_000, bytes32(0));
        assertFalse(paid);
        assertEq(uint8(reason), uint8(ScaleTicket.Reason.NotConfirmed));
        assertEq(uint8(_status(id)), uint8(ScaleTicket.Status.Open));
    }

    function test_witnessCannotBeIssuerPayeeOrAgent() public {
        vm.startPrank(owner);
        st.setRoles(house, clerk, st.ROLE_ISSUER() | st.ROLE_WITNESS());
        st.setRoles(house, supplier, st.ROLE_WITNESS());
        uint8 witnessRole = st.ROLE_WITNESS();
        vm.expectRevert(ScaleTicket.RoleConflict.selector);
        st.setRoles(house, agent, witnessRole);
        vm.stopPrank();

        uint256 id = _cut(1_000, keccak256("note-5"));
        vm.prank(clerk);
        vm.expectRevert(ScaleTicket.WitnessConflict.selector);
        st.confirm(id, 1_000);

        vm.prank(supplier);
        vm.expectRevert(ScaleTicket.WitnessConflict.selector);
        st.confirm(id, 1_000);
    }

    function test_agentCannotHoldARole() public {
        vm.startPrank(owner);
        st.setRoles(house, other, st.ROLE_WITNESS());
        vm.expectRevert(ScaleTicket.RoleConflict.selector);
        st.setAgent(house, other);
        vm.stopPrank();
    }

    function test_onlyAgentReleases() public {
        uint256 id = _confirmed(1_000);
        vm.prank(owner);
        vm.expectRevert(ScaleTicket.NotAgent.selector);
        st.release(id, supplier, 2_000_000, bytes32(0));
    }

    function test_dailyCapRefusesThenAllowsNextDay() public {
        uint256 a = _confirmed(25_000); // $50
        uint256 b = _confirmed(25_000); // $50
        uint256 c = _confirmed(500); // $1
        vm.startPrank(agent);
        st.release(a, supplier, 50_000_000, bytes32(0));
        st.release(b, supplier, 50_000_000, bytes32(0));
        (bool paid, ScaleTicket.Reason reason) = st.release(c, supplier, 1_000_000, bytes32(0));
        assertFalse(paid);
        assertEq(uint8(reason), uint8(ScaleTicket.Reason.OverDailyCap));
        assertEq(uint8(_status(c)), uint8(ScaleTicket.Status.Confirmed), "refusal leaves ticket payable");

        vm.warp(block.timestamp + 1 days);
        (paid,) = st.release(c, supplier, 1_000_000, bytes32(0));
        assertTrue(paid);
        vm.stopPrank();
    }

    function test_ticketOverMaxCannotBeCut() public {
        vm.prank(clerk);
        vm.expectRevert(ScaleTicket.OverTicketCap.selector);
        st.cut(house, supplier, RICE, 25_001, keccak256("big"));
    }

    function test_agentMayOnlyLowerAPayeeCap() public {
        vm.startPrank(agent);
        st.setPayeeCap(house, supplier, 5_000_000, keccak256("late twice"));
        vm.expectRevert(ScaleTicket.CapNotLowered.selector);
        st.setPayeeCap(house, supplier, 6_000_000, bytes32(0));
        vm.stopPrank();

        uint256 id = _confirmed(5_000); // $10 > $5 cap
        vm.prank(agent);
        (bool paid, ScaleTicket.Reason reason) = st.release(id, supplier, 10_000_000, bytes32(0));
        assertFalse(paid);
        assertEq(uint8(reason), uint8(ScaleTicket.Reason.OverPayeeCap));

        vm.prank(owner);
        st.setPayeeCap(house, supplier, 20_000_000, keccak256("reviewed"));
        vm.prank(agent);
        (paid,) = st.release(id, supplier, 10_000_000, bytes32(0));
        assertTrue(paid);
    }

    function test_insufficientAllowanceIsRefusedNotReverted() public {
        uint256 id = _confirmed(1_000);
        vm.prank(owner);
        usdc.approve(address(st), 1_999_999);
        vm.prank(agent);
        (bool paid, ScaleTicket.Reason reason) = st.release(id, supplier, 2_000_000, bytes32(0));
        assertFalse(paid);
        assertEq(uint8(reason), uint8(ScaleTicket.Reason.InsufficientFloat));
    }

    function test_protocolAndHousePauseStopReleases() public {
        uint256 id = _confirmed(1_000);
        vm.prank(admin);
        st.pause();
        vm.prank(agent);
        (, ScaleTicket.Reason reason) = st.release(id, supplier, 2_000_000, bytes32(0));
        assertEq(uint8(reason), uint8(ScaleTicket.Reason.Paused));

        vm.prank(admin);
        st.unpause();
        vm.prank(owner);
        st.setHousePaused(house, true);
        vm.prank(agent);
        (, reason) = st.release(id, supplier, 2_000_000, bytes32(0));
        assertEq(uint8(reason), uint8(ScaleTicket.Reason.Paused));
    }

    function test_expiredRateCannotBeCut() public {
        vm.warp(block.timestamp + 31 days);
        vm.prank(clerk);
        vm.expectRevert(ScaleTicket.RateUnavailable.selector);
        st.cut(house, supplier, RICE, 1_000, keccak256("late"));
    }

    function test_priceIsSnapshottedAtCut() public {
        uint256 id = _cut(1_000, keccak256("note-6"));
        vm.prank(owner);
        st.setRate(house, RICE, 9_000_000, uint64(block.timestamp + 1 days), true, "repriced");
        vm.prank(witness);
        st.confirm(id, 1_000);
        assertEq(st.grossOf(id), 2_000_000);
    }

    function test_ownerReopensFrozenTicketForFreshReading() public {
        uint256 id = _cut(10_000, keccak256("note-7"));
        vm.prank(witness);
        st.confirm(id, 5_000);
        vm.prank(owner);
        st.reopen(id, keccak256("re-weighed"));
        vm.prank(witness);
        st.confirm(id, 10_000);
        vm.prank(agent);
        (bool paid,) = st.release(id, supplier, 20_000_000, bytes32(0));
        assertTrue(paid);
    }

    function test_voidFreesEvidenceForCorrectedTicket() public {
        uint256 id = _cut(1_000, keccak256("invoice-9"));
        vm.prank(owner);
        st.voidTicket(id, keccak256("typo"));
        uint256 fixedId = _cut(2_000, keccak256("invoice-9"));
        assertGt(fixedId, id);
    }

    function test_houseOwnershipNeedsAcceptance() public {
        vm.prank(other);
        vm.expectRevert(ScaleTicket.NotPendingOwner.selector);
        st.acceptHouse(house);

        vm.prank(owner);
        st.offerHouse(house, other);
        vm.prank(other);
        st.acceptHouse(house);
        (address newOwner,,,,,,,,,) = st.houses(house);
        assertEq(newOwner, other);
    }

    function test_payeeCannotBeOwnerOrAgent() public {
        vm.startPrank(clerk);
        vm.expectRevert(ScaleTicket.BadPayee.selector);
        st.cut(house, owner, RICE, 1_000, keccak256("x"));
        vm.expectRevert(ScaleTicket.BadPayee.selector);
        st.cut(house, agent, RICE, 1_000, keccak256("y"));
        vm.stopPrank();
    }

    function test_badSignatureRejected() public {
        uint256 id = _cut(1_000, keccak256("note-8"));
        uint256 deadline = block.timestamp + 1 hours;
        (, uint256 wrongKey) = makeAddrAndKey("impostor");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, st.confirmDigest(id, 1_000, deadline));
        vm.expectRevert(ScaleTicket.BadSignature.selector);
        st.confirmBySig(id, 1_000, witness, deadline, abi.encodePacked(r, s, v));
    }

    // ------------------------------------------------------------ fuzz

    /// The amount paid is always exactly confirmedQuantity * unitPrice / 1000, never what the
    /// agent asks for, and is paid at most once.
    function testFuzz_paysOnlyTheRuleAmountOnce(uint64 qty, uint128 price, uint256 asked) public {
        qty = uint64(bound(qty, 1, 1_000_000_000));
        price = uint128(bound(price, 1, 10_000_000_000));
        uint256 gross = (uint256(qty) * price) / 1000;
        vm.assume(gross > 0 && gross <= MAX_TICKET);

        vm.prank(owner);
        st.setRate(house, RICE, price, uint64(block.timestamp + 1 days), true, "");
        uint256 id = _cut(qty, keccak256(abi.encode(qty, price)));
        vm.prank(witness);
        st.confirm(id, qty);

        vm.prank(agent);
        (bool paid,) = st.release(id, supplier, asked, bytes32(0));
        assertEq(paid, asked == gross);
        assertEq(usdc.balanceOf(supplier), paid ? gross : 0);

        vm.prank(agent);
        (bool again,) = st.release(id, supplier, gross, bytes32(0));
        assertFalse(again);
        assertEq(usdc.balanceOf(supplier), paid ? gross : 0);
    }

    function testFuzz_witnessToleranceBoundary(uint64 observed) public {
        uint64 claimed = 10_000;
        observed = uint64(bound(observed, 0, 20_000));
        uint256 id = _cut(claimed, keccak256(abi.encode("tol", observed)));
        vm.prank(witness);
        st.confirm(id, observed);

        uint256 diff = observed > claimed ? observed - claimed : claimed - observed;
        bool within = observed != 0 && diff * 10_000 <= uint256(claimed) * 200;
        assertEq(uint8(_status(id)), uint8(within ? ScaleTicket.Status.Confirmed : ScaleTicket.Status.Frozen));
        if (within) assertLe(st.grossOf(id), (uint256(claimed) * PRICE) / 1000);
    }
}
