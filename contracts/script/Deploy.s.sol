// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ScaleTicket} from "../src/ScaleTicket.sol";

/// forge script script/Deploy.s.sol --rpc-url arc_mainnet --broadcast --private-key $DEPLOYER_PRIVATE_KEY
/// The protocol admin (PROTOCOL_ADMIN, defaults to the deployer) can only pause and unpause
/// releases. It has no power over any house's funds, tickets, or settings.
contract Deploy is Script {
    function run() external returns (ScaleTicket st) {
        address admin = vm.envOr("PROTOCOL_ADMIN", msg.sender);
        vm.startBroadcast();
        st = new ScaleTicket(admin);
        vm.stopBroadcast();
        console.log("ScaleTicket", address(st));
        console.log("admin", admin);
        console.log("block", block.number);
    }
}
