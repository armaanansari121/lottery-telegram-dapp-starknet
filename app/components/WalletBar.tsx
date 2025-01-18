"use client";

import Address from "./address";
import { useLottery } from "../contexts/LotteryContext";

const WalletBar: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
  const { isConnected, handleConnectButton } = useLottery();

  return (
    <div className={`flex items-center ${isMobile ? "w-full" : ""}`}>
      {!isConnected ? (
        <>
          <button
            onClick={() => handleConnectButton()}
            className={`
              py-2 px-4 bg-[#9370DB] rounded-full text-sm leading-5 
              hover:bg-[#483D8B] text-white font-semibold transition-colors
              ${isMobile ? "w-full py-3 text-base" : "sm:py-3 sm:w-[200px]"}
            `}
          >
            Connect Wallet
          </button>
        </>
      ) : (
        <Address isMobile={isMobile} />
      )}
    </div>
  );
};

export default WalletBar;
