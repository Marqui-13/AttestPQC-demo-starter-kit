// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {PQCAttestationRegistry} from "../src/PQCAttestationRegistry.sol";

contract DeployPQCAttestationRegistry is Script {
    function run() external returns (address proxy) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        PQCAttestationRegistry implementation = new PQCAttestationRegistry();
        bytes memory initData = abi.encodeCall(PQCAttestationRegistry.initialize, (deployer));

        ERC1967Proxy registryProxy = new ERC1967Proxy(address(implementation), initData);
        proxy = address(registryProxy);

        PQCAttestationRegistry registry = PQCAttestationRegistry(proxy);
        registry.grantRole(registry.ISSUER_ROLE(), deployer);

        vm.stopBroadcast();

        console2.log("Implementation:", address(implementation));
        console2.log("Proxy (use this in frontend):", proxy);
        console2.log("Admin:", deployer);
    }
}