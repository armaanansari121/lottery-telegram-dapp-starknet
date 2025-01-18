import { ArgentTMA, SessionAccountInterface } from "@argent/tma-wallet";
import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Contract, cairo, CallData } from "starknet";
import {
  ETH_TOKEN_ADDRESS,
  provider,
  LOTTERY_FACTORY_ADDRESS,
  PRAGMA_VRF_FEES,
  CALLBACK_FEE_LIMIT,
  KNOWN_TOKENS,
} from "../constants";
import {
  LotteryDetails,
  LotterySection,
  MyLotteryType,
  TokenDetails,
  LotteryState,
  FetchedLottery,
  LotteryContextType,
} from "../types";

import {
  getRandomNumber,
  convertToStarknetAddress,
  convertAddressToStarknetAddress,
  decimalToText,
} from "../utils";

const LotteryContext = createContext<LotteryContextType | undefined>(undefined);

export function LotteryProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<SessionAccountInterface | undefined>();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lotteries, setLotteries] = useState<LotteryDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<LotterySection>("active");
  const [myLotteryType, setMyLotteryType] = useState<MyLotteryType>("enrolled");
  const [filteredLotteries, setFilteredLotteries] = useState<LotteryDetails[]>(
    []
  );

  const argentTMA = ArgentTMA.init({
    environment: "sepolia", // "sepolia" | "mainnet" (not supperted yet)
    appName: "StarknetLottery", // Your Telegram app name
    appTelegramUrl: "https://t.me/StarknetLotteryBot/StarknetLottery", // Your Telegram app URL
    sessionParams: {
      allowedMethods: [
        // List of contracts/methods allowed to be called by the session key
        {
          contract:
            "0x036133c88c1954413150db74c26243e2af77170a4032934b275708d84ec5452f", // contract address
          selector: "increment", //function selector
        },
      ],
      validityDays: 90, // session validity (in days) - default: 90
    },
  });

  const getTokenDetails = async (
    tokenAddress: string
  ): Promise<TokenDetails> => {
    if (KNOWN_TOKENS.find((token) => token.address === tokenAddress)) {
      return KNOWN_TOKENS.find((token) => token.address === tokenAddress)!;
    }

    const { abi: ERC20Abi } = await provider.getClassAt(tokenAddress);
    const tokenContract = new Contract(
      ERC20Abi,
      tokenAddress,
      provider
    ).typedv2(ERC20Abi);

    try {
      let [symbol, name, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.name(),
        tokenContract.decimals(),
      ]);

      name = decimalToText(name);
      symbol = decimalToText(symbol);
      decimals = Number(decimals);

      const tokenDetails: TokenDetails = {
        address: tokenAddress,
        name,
        symbol,
        decimals,
        logo: null,
      };
      return tokenDetails;
    } catch (error) {
      console.error(`Error fetching token details for ${tokenAddress}:`, error);
      return {
        address: tokenAddress,
        name: "Unknown Token",
        symbol: "???",
        decimals: 18,
        logo: null,
      };
    }
  };

  const fetchLotteryDetails = useCallback(async (lotteryAddress: string) => {
    try {
      const { abi: LotteryABI } = await provider.getClassAt(lotteryAddress);
      const lotteryContract = new Contract(
        LotteryABI,
        lotteryAddress,
        provider
      ).typedv2(LotteryABI);
      const details = await lotteryContract.get_lottery_details();

      const participants = details[1].map((participant: bigint) =>
        convertToStarknetAddress(participant)
      );
      const tokenAddress = convertToStarknetAddress(details[2]);
      const tokenDetails = await getTokenDetails(tokenAddress);

      let state;
      if (details[5].variant.Active) {
        state = LotteryState.ACTIVE;
      } else if (details[5].variant.WinnerSelected) {
        state = LotteryState.WINNER_SELECTED;
      } else {
        state = LotteryState.CLOSED;
      }

      return {
        address: lotteryAddress,
        owner: convertToStarknetAddress(details[0]),
        participants,
        token: tokenDetails,
        participant_fees: details[3],
        winner:
          details[4] == BigInt(0)
            ? "No winner yet"
            : convertToStarknetAddress(details[4]),
        state,
      };
    } catch (error) {
      console.error(
        `Error fetching details for lottery ${lotteryAddress}:`,
        error
      );
      return null;
    }
  }, []);

  const fetchLotteries = useCallback(async () => {
    try {
      const { abi: FactoryABI } = await provider.getClassAt(
        LOTTERY_FACTORY_ADDRESS
      );
      const factory_contract = new Contract(
        FactoryABI,
        LOTTERY_FACTORY_ADDRESS,
        provider
      ).typedv2(FactoryABI);
      const lotteryAddresses = await factory_contract.get_lotteries();
      const detailPromises = lotteryAddresses.map((lottery: FetchedLottery) => {
        const starknetAddress = convertToStarknetAddress(
          lottery.lottery_address
        );
        return fetchLotteryDetails(starknetAddress);
      });

      const allDetails = await Promise.allSettled(detailPromises);
      const successfulFetches = allDetails
        .filter(
          (result) => result.status === "fulfilled" && result.value !== null
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((result: any) => result.value);

      setLotteries(successfulFetches.reverse());
      return successfulFetches;
    } catch (error) {
      console.error("Error fetching lotteries:", error);
      setLotteries([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [fetchLotteryDetails]);

  const createLottery = async (token: string, participantFees: string) => {
    try {
      const selectedToken = await getTokenDetails(token);
      const amount = BigInt(
        Math.floor(
          parseFloat(participantFees) * Math.pow(10, selectedToken.decimals)
        )
      );

      const multiCall = await account?.execute([
        {
          contractAddress: ETH_TOKEN_ADDRESS,
          entrypoint: "approve",
          calldata: CallData.compile({
            spender: LOTTERY_FACTORY_ADDRESS,
            amount: cairo.uint256(PRAGMA_VRF_FEES),
          }),
        },
        {
          contractAddress: LOTTERY_FACTORY_ADDRESS,
          entrypoint: "create_lottery",
          calldata: CallData.compile({
            token,
            participant_fees: cairo.uint256(amount),
            salt: getRandomNumber(),
          }),
        },
      ]);

      await provider.waitForTransaction(multiCall?.transaction_hash || "");
      await fetchLotteries();
    } catch (error) {
      console.error("Error creating lottery:", error);
      throw error;
    }
  };

  const enrollInLottery = async (
    lotteryAddress: string,
    participantFees: string,
    token: string
  ) => {
    try {
      const selectedToken = await getTokenDetails(token);
      const amount = BigInt(
        Math.floor(
          parseFloat(participantFees) * Math.pow(10, selectedToken.decimals)
        )
      );

      const multiCall = await account?.execute([
        {
          contractAddress: token,
          entrypoint: "approve",
          calldata: CallData.compile({
            spender: lotteryAddress,
            amount: cairo.uint256(amount),
          }),
        },
        {
          contractAddress: lotteryAddress,
          entrypoint: "enroll",
          calldata: CallData.compile({}),
        },
      ]);

      await provider.waitForTransaction(multiCall?.transaction_hash || "");
      await fetchLotteries();
    } catch (error) {
      console.error("Error enrolling in lottery:", error);
      throw error;
    }
  };

  const selectWinner = async (lotteryAddress: string) => {
    try {
      const multiCall = await account?.execute([
        {
          contractAddress: lotteryAddress,
          entrypoint: "select_winner",
          calldata: CallData.compile({
            seed: BigInt(getRandomNumber()).toString(),
            callback_fee_limit: CALLBACK_FEE_LIMIT,
            publish_delay: "1",
            num_words: "1",
            calldata: [],
          }),
        },
      ]);

      await provider.waitForTransaction(multiCall?.transaction_hash || "");
      await fetchLotteries();
    } catch (error) {
      console.error("Error selecting the winner:", error);
      throw error;
    }
  };

  const withdrawOracleFees = async (lotteryAddress: string) => {
    try {
      const multiCall = await account?.execute([
        {
          contractAddress: lotteryAddress,
          entrypoint: "withdraw_oracle_fees",
          calldata: CallData.compile({}),
        },
      ]);

      await provider.waitForTransaction(multiCall?.transaction_hash || "");
      await fetchLotteries();
    } catch (error) {
      console.error("Error withdrawing the oracle fees:", error);
      throw error;
    }
  };

  useEffect(() => {
    // Call connect() as soon as the app is loaded
    argentTMA
      .connect()
      .then((res) => {
        if (!res) {
          // Not connected
          setIsConnected(false);
          return;
        }

        // Connected
        const { account, callbackData } = res;

        if (account.getSessionStatus() !== "VALID") {
          // Session has expired or scope (allowed methods) has changed
          // A new connection request should be triggered

          // The account object is still available to get access to user's address
          // but transactions can't be executed
          const { account } = res;

          setAccount(account);
          setIsConnected(false);
          return;
        }

        // Connected
        // const { account, callbackData } = res;
        // The session account is returned and can be used to submit transactions
        setAccount(account);
        setIsConnected(true);
        // Custom data passed to the requestConnection() method is available here
        console.log("callback data:", callbackData);
      })
      .catch((err) => {
        console.error("Failed to connect", err);
      });
  }, [argentTMA]);

  useEffect(() => {
    if (activeSection === "active") {
      setFilteredLotteries(
        lotteries.filter((lottery) => lottery.state === LotteryState.ACTIVE)
      );
    } else if (activeSection === "past") {
      setFilteredLotteries(
        lotteries.filter(
          (lottery) =>
            lottery.state === LotteryState.CLOSED ||
            lottery.state === LotteryState.WINNER_SELECTED
        )
      );
    } else if (activeSection === "my") {
      if (myLotteryType === "created") {
        setFilteredLotteries(
          lotteries.filter(
            (lottery) =>
              lottery.owner ===
              convertAddressToStarknetAddress(account?.address || "")
          )
        );
      } else {
        setFilteredLotteries(
          lotteries.filter((lottery) =>
            lottery.participants.includes(
              convertAddressToStarknetAddress(account?.address || "")
            )
          )
        );
      }
    }
  }, [account, activeSection, lotteries, myLotteryType]);

  useEffect(() => {
    fetchLotteries();
  }, [fetchLotteries]);

  const handleConnectButton = async () => {
    await argentTMA.requestConnection({
      callbackData: "custom_callback",
    });
  };

  // useful for debugging
  const handleClearSessionButton = async () => {
    await argentTMA.clearSession();
    setAccount(undefined);
  };

  const value = {
    account,
    isConnected,
    handleConnectButton,
    handleClearSessionButton,
    lotteries,
    loading,
    filteredLotteries,
    activeSection,
    myLotteryType,
    setActiveSection,
    setMyLotteryType,
    createLottery,
    enrollInLottery,
    selectWinner,
    withdrawOracleFees,
    refreshLotteries: fetchLotteries,
  };

  return (
    <LotteryContext.Provider value={value}>{children}</LotteryContext.Provider>
  );
}

// Custom hook to use the lottery context
export function useLottery() {
  const context = useContext(LotteryContext);
  if (context === undefined) {
    throw new Error("useLottery must be used within a LotteryProvider");
  }
  return context;
}
