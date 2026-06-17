// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {FrontleGame} from "../src/FrontleGame.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

// ============================================================
//  Despliegue de FrontleGame
//
//  Variables de entorno (.env):
//   - OPERATOR        (address) backend que cierra los días (rollDay). OBLIGATORIA.
//   - TOKEN_ADDRESS   (address) stablecoin. Si NO se da → despliega un MockERC20
//                      (testnet). En Mainnet, pasar la dirección de USDm.
//   - ATTEMPT_FEE     (uint) precio del reintento. Por defecto 0.10 (18 dec).
//   - PROTOCOL_BPS    (uint) % al protocolo en basis points. Por defecto 2000 (20%).
//   - HINT_FEE_INITIAL / HINT_FEE_NEXT / HINT_FEE_ALL — pistas 0/1/2. Def: 0.05/0.05/0.10.
//
//  Uso:
//   forge script script/Deploy.s.sol --rpc-url celo_sepolia --account frontle-deployer --broadcast
// ============================================================

contract Deploy is Script {
    function run() external returns (FrontleGame game, address token) {
        address operator = vm.envAddress("OPERATOR");
        uint256 attemptFee = vm.envOr("ATTEMPT_FEE", uint256(0.10 ether));
        uint256 protocolBps = vm.envOr("PROTOCOL_BPS", uint256(2000));
        uint256 hintInitial = vm.envOr("HINT_FEE_INITIAL", uint256(0.05 ether));
        uint256 hintNext = vm.envOr("HINT_FEE_NEXT", uint256(0.05 ether));
        uint256 hintAll = vm.envOr("HINT_FEE_ALL", uint256(0.10 ether));
        address tokenAddr = vm.envOr("TOKEN_ADDRESS", address(0));

        vm.startBroadcast();

        // Testnet: sin TOKEN_ADDRESS → desplegamos un stablecoin de prueba y
        // minteamos saldo al deployer para sembrar el pot y simular pagos.
        if (tokenAddr == address(0)) {
            MockERC20 mock = new MockERC20("Frontle Test USD", "tUSD", 18);
            mock.mint(msg.sender, 1_000 ether);
            tokenAddr = address(mock);
            console.log("MockERC20 (test stablecoin):", tokenAddr);
        }

        game = new FrontleGame(tokenAddr, operator, attemptFee, protocolBps);

        // Precios de pista (0=inicial, 1=siguiente silueta, 2=todas).
        game.setHintFee(0, hintInitial);
        game.setHintFee(1, hintNext);
        game.setHintFee(2, hintAll);

        vm.stopBroadcast();

        token = tokenAddr;
        console.log("FrontleGame:", address(game));
        console.log("token:", token);
        console.log("operator:", operator);
        console.log("attemptFee:", attemptFee);
        console.log("protocolBps:", protocolBps);
        console.log("hintFee[0/1/2]:", hintInitial, hintNext, hintAll);
    }
}
