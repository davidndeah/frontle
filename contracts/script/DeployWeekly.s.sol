// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {FrontleWeekly} from "../src/FrontleWeekly.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

// ============================================================
//  Despliegue de FrontleWeekly (pot semanal de la liga, Frontle v2)
//
//  Variables de entorno (.env):
//   - OPERATOR        (address) backend que cierra las semanas (rollWeek). OBLIGATORIA.
//   - TOKEN_ADDRESS   (address) stablecoin. Sin ella → despliega un MockERC20
//                      (testnet). En Mainnet: USDT 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e (6 dec).
//   - MIN_PURCHASE    (uint) compra mínima de monedas. Def: 0.10 USDT = 100000 (6 dec).
//   - PROTOCOL_BPS    (uint) recaudo al repartir. Def: 1000 (10%).
//
//  OJO con los decimales: USDT en Celo tiene 6, no 18. MIN_PURCHASE se pasa
//  en unidades mínimas del token (100000 = 0.10 USDT).
//
//  Uso (mainnet):
//   forge script script/DeployWeekly.s.sol --rpc-url celo --account frontle-deployer --broadcast
// ============================================================

contract DeployWeekly is Script {
    function run() external returns (FrontleWeekly weekly, address token) {
        address operator = vm.envAddress("OPERATOR");
        uint256 minPurchase = vm.envOr("MIN_PURCHASE", uint256(100_000)); // 0.10 USDT (6 dec)
        uint256 protocolBps = vm.envOr("PROTOCOL_BPS", uint256(1000)); // 10%
        address tokenAddr = vm.envOr("TOKEN_ADDRESS", address(0));

        vm.startBroadcast();

        if (tokenAddr == address(0)) {
            MockERC20 mock = new MockERC20("Frontle Test USD", "tUSD", 18);
            mock.mint(msg.sender, 1_000 ether);
            tokenAddr = address(mock);
            console.log("MockERC20 (test stablecoin):", tokenAddr);
        }

        weekly = new FrontleWeekly(tokenAddr, operator, minPurchase, protocolBps);

        vm.stopBroadcast();

        token = tokenAddr;
        console.log("FrontleWeekly:", address(weekly));
        console.log("token:", token);
        console.log("operator:", operator);
        console.log("minPurchase:", minPurchase);
        console.log("protocolBps:", protocolBps);
    }
}
