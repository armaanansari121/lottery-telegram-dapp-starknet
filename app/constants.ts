import { RpcProvider } from "starknet";
import { TokenDetails } from "./types";
import starknet from "../public/starknet.svg";
import eth from "../public/eth.svg";
import usdc from "../public/usdc.svg";
import usdt from "../public/usdt.svg";

export const LOTTERY_FACTORY_ADDRESS =
  "0x00cfd32cb1fe08669eaf6ec9c00935f5a03526a5bd38af62d26c3b574dd99412";
export const ETH_TOKEN_ADDRESS =
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
export const STRK_TOKEN_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export const PRAGMA_VRF_FEES = BigInt("20000000000000000");
export const CALLBACK_FEE_LIMIT = "10000000000000000";

export const voyagerScanBaseUrl = "https://sepolia.voyager.online";

export const provider = new RpcProvider({
  nodeUrl: "https://starknet-sepolia.public.blastapi.io",
});

export const KNOWN_TOKENS: TokenDetails[] = [
  {
    address: ETH_TOKEN_ADDRESS,
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
    logo: eth,
  },
  {
    address: STRK_TOKEN_ADDRESS,
    name: "Starknet Token",
    symbol: "STRK",
    decimals: 18,
    logo: starknet,
  },
  {
    address:
      "0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080",
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
    logo: usdc,
  },
  {
    address:
      "0x02ab8758891e84b968ff11361789070c6b1af2df618d6d2f4a78b0757573c6eb",
    name: "USDT",
    symbol: "USDT",
    decimals: 6,
    logo: usdt,
  },
];
