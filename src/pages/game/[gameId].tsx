import { type NextPage } from "next";
import { api } from "~/utils/api";
import { type GetServerSideProps } from 'next';
import { type Game } from "~/types/deck";
import { useEffect, useState } from "react";
import Image from "next/image";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { gameId } = context.params as { gameId: string };
  return {
    props: {
      gameId,
    },
  };
};

export const GamePage: NextPage<{ gameId: string }> = ({ gameId }) => {
  const [game, setGame] = useState<Game | null>(null);
  
  const { data: gameData } = api.game.getById.useQuery({
    id: gameId,
  }, {
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: !!gameId,
  });

  useEffect(() => {
    if (gameData) {
      setGame(gameData);
    }
  }, [gameData]);

  const { mutateAsync: dealRound } = api.game.dealRound.useMutation();
  const handleDealRound = async () => {
    if (!game) return;
    try {
      const gameData = await dealRound({ gameId: game.id.toString(), players: ["Player 1", "Player 2"] });
      console.log({ gameData });
      setGame(gameData);
    } catch (e) {
      console.error(e);
    }
  }

  const { mutateAsync: hit } = api.game.hit.useMutation();
  const handleHit = async (playerId: string) => {
    if (!game) return;
    try {
      const gameData = await hit({ gameId: game.id.toString(), playerId });
      console.log({ gameData });
      setGame(gameData);
    } catch (e) {
      console.error(e);
    }
  }

  const { mutateAsync: stand } = api.game.stand.useMutation();
  const handleStand = async (playerId: string) => {
    if (!game) return;
    try {
      const gameData = await stand({ gameId: game.id.toString(), playerId });
      console.log({ gameData });
      setGame(gameData);
    } catch (e) {
      console.error(e);
    }
  }

  const { mutateAsync: revealDealerHand } = api.game.revealDealerHand.useMutation();
  const handleRevealDealerHand = async () => {
    if (!game) return;
    try {
      const gameData = await revealDealerHand({ gameId: game.id.toString() });
      console.log({ gameData });
      setGame(gameData);
    } catch (e) {
      console.error(e);
    }
  }

  const [imgErrorRetries, setImgErrorRetries] = useState<Record<string, number>>({});

  return (
    <div>
      <h1>Game: {game?.name}</h1>
      <p>Deck ID: {game?.deckId}</p>
      <button
        onClick={handleDealRound}
        className="px-4 py-2 text-lg font-bold text-white bg-[#ff0080] rounded-xl hover:bg-[#ff0066]"
      >
        Deal Round
      </button>
      <div className="grid grid-flow-row grid-cols-2 gap-4">
        {game?.players.map((player) => (
          <div key={player.name} className="bg-white p-4 rounded-xl">
            <h2>{player.name}: {player.total}</h2>
            <div className="flex items-center gap-2">
              {player.hand.map((card, index) => (
                <Image 
                  key={card.code + index}
                  src={card.image}
                  width={100}
                  height={150}
                  alt={card.code}
                  onError={(e) => {
                    e.preventDefault();
                    const retries = imgErrorRetries[card.code] ?? 0;
                    if (retries >= 3) return;
                    e.currentTarget.src = card.images.png;
                    setImgErrorRetries((prev) => ({ ...prev, [card.code]: retries + 1 }));
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {player.isDealer && game.players.every((player) => (player.isDealer && !player.hand.every(card => card.isVisible)) || player.isStanding || player.total > 21) ? (
                <button
                  onClick={() => void handleRevealDealerHand() }
                  className="px-4 py-2 text-lg font-bold text-white bg-[#ff0080] rounded-xl hover:bg-[#ff0066] disabled:bg-gray-400"
                >
                  Reveal
                </button>
              ) : (
                <>
                  <button
                    onClick={() => void handleHit(player.name)}
                    disabled={player.isStanding || player.total > 21}
                    className="px-4 py-2 text-lg font-bold text-white bg-[#ff0080] rounded-xl hover:bg-[#ff0066] disabled:bg-gray-400"
                  >
                    Hit
                  </button>
                  <button
                    onClick={() => void handleStand(player.name)}
                    disabled={player.isStanding || player.total > 21}
                    className="px-4 py-2 text-lg font-bold text-white bg-[#ff0080] rounded-xl hover:bg-[#ff0066] disabled:bg-gray-400"
                  >
                    Stand
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
};

export default GamePage;