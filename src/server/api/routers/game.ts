import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { type Player, type Card, type DealData, type DeckData, type Game } from "~/types/deck";
import { createClient } from "@vercel/kv";
import { env } from "~/env";
 
const gameDb = createClient({
  url: env.KV_REST_API_URL,
  token: env.KV_API_TOKEN,
});

// const games: Game[] = [
//   {
//     id: 1,
//     name: "Hello World",
//     deckId: "rrhtrll16ecp",
//     dealt: false,
//     players: [],
//   },
// ];

const cardFids = {
  'A': 99, // jesse pollak
  'K': 8152, // undefined
  'Q': 239, // ted
  'J': 4085, // christopher
  '10': 680, // woj.eth
  '9': 576, // johnny mack nonlinear.eth
  '8': 2433, // seneca
  '7': 221578, // apex
  '6': 7143, // six
  '5': 7732, // aneri
  '4': 3621, // horsefacts
  '3': 3, // dwr.eth
  '2': 1317, // 0xdesigner
  '1': 3642, // toady hawk
}

const cardValues = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1'] as const;
type CardValue = typeof cardValues[number];

const getCardImage = (card: Card) => {
  let cardValue = card.code.slice(0, -1);
  if (cardValue === '0') {
    cardValue = '10' as CardValue;
  }
  const suitLetter = card.code.slice(-1);
  const fid = cardFids[cardValue as CardValue];
  return `https://far.cards/api/deck/${suitLetter}/${cardValue}/${fid}`;
}

const transformPlayerHand = (player: Player) => ({
  ...player,
  hand: player.hand.map((card) => ({
    ...card,
    code: card.isVisible ? card.code : "XX",
    image: card.isVisible ? getCardImage(card) : "https://www.deckofcardsapi.com/static/img/back.png",
    images: {
      svg: card.isVisible ? card.images.svg : "https://www.deckofcardsapi.com/static/img/back.png",
      png: card.isVisible ? card.images.png : "https://www.deckofcardsapi.com/static/img/back.png",
    },
    suit: card.isVisible ? card.suit : "XX",
    value: card.isVisible ? card.value : "XX",
  })),
});

const NUM_DECKS = 6;

export const gameRouter = createTRPCRouter({
  create: publicProcedure
    .input(z.object({ 
      name: z.string().min(1),
      players: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      const deckRes = await fetch(`https://www.deckofcardsapi.com/api/deck/new/shuffle/?deck_count=${NUM_DECKS}`);
      const deckData = await deckRes.json() as DeckData;
      const nextGameId = await gameDb.incr("gameId");
      console.log({ nextGameId });
      // const games = await gameDb.hgetall("game:1") as unknown as Game[];
      const game: Game = {
        id: nextGameId,
        name: input.name,
        deckId: deckData.deck_id,
        dealt: false,
        players: [{
          name: "Dealer",
          hand: [],
          isDealer: true,
          total: 0,
          isStanding: false,
        }].concat(input.players.map((player) => ({
          name: player,
          hand: [],
          isDealer: false,
          total: 0,
          isStanding: false,
        }))),
      };
      console.log({ game });
      return await gameDb.hset(nextGameId.toString(), game as unknown as Record<string, unknown>);
    }),
  getById: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ input }) => {
      const game = await gameDb.hgetall(input.id) as unknown as Game;
      return {
        ...game,
        players: game.players.map(transformPlayerHand),
      }
    }),
  dealRound: publicProcedure
    .input(z.object({
      gameId: z.string(),
      players: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      const game = await gameDb.hgetall(input.gameId) as unknown as Game;
      if (!game) {
        throw new Error("Game not found");
      }
      if (game.dealt) {
        throw new Error("Game already dealt");
      }
      const numPlayersPlusDealer = input.players.length + 1;
      const numCardsDrawn = numPlayersPlusDealer * 2;
      const dealRes = await fetch(`https://www.deckofcardsapi.com/api/deck/${game.deckId}/draw/?count=${numCardsDrawn}`);
      const dealData = await dealRes.json() as DealData;

      // deal cards to players
      game.players.forEach((player, i) => {
        player.hand = dealData.cards.slice(i * 2, i * 2 + 2);
        player.total = player.hand.reduce((total, card) => {
          const value = parseInt(card.value);
          return isNaN(value) ? total + 10 : total + value;
        }, 0);
        if (player.isDealer) {
          player.hand[0]!.isVisible = false;
          player.hand[1]!.isVisible = true;
          return;
        }
        player.hand[0]!.isVisible = true;
        player.hand[1]!.isVisible = true;
      });
      game.dealt = true;

      await gameDb.hset(input.gameId, game as unknown as Record<string, unknown>);

      return {
        ...game,
        players: game.players.map(transformPlayerHand),
      }
    }),
  hit: publicProcedure
    .input(z.object({
      gameId: z.string(),
      playerId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const game = await gameDb.hgetall(input.gameId) as unknown as Game;
      if (!game) {
        throw new Error("Game not found");
      }
      if (!game.dealt) {
        throw new Error("Game not dealt");
      }
      const dealRes = await fetch(`https://www.deckofcardsapi.com/api/deck/${game.deckId}/draw/?count=1`);
      const dealData = await dealRes.json() as DealData;
      const player = game.players.find((player) => player.name === input.playerId)!;
      player.hand.push({
        ...dealData.cards[0]!,
        isVisible: true,
      });
      player.total = player.hand.reduce((total, card) => {
        const value = parseInt(card.value);
        return isNaN(value) ? total + 10 : total + value;
      }, 0);

      await gameDb.hset(input.gameId, game as unknown as Record<string, unknown>);

      return {
        ...game,
        players: game.players.map(transformPlayerHand),
      }
    }),
  stand: publicProcedure
    .input(z.object({
      gameId: z.string(),
      playerId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const game = await gameDb.hgetall(input.gameId) as unknown as Game;
      if (!game) {
        throw new Error("Game not found");
      }
      if (!game.dealt) {
        throw new Error("Game not dealt");
      }
      const player = game.players.find((player) => player.name === input.playerId)!;
      player.isStanding = true;

      await gameDb.hset(input.gameId, game as unknown as Record<string, unknown>);

      return {
        ...game,
        players: game.players.map(transformPlayerHand),
      }
    }),
  revealDealerHand: publicProcedure
    .input(z.object({
      gameId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const game = await gameDb.hgetall(input.gameId) as unknown as Game;
      if (!game) {
        throw new Error("Game not found");
      }
      if (!game.dealt) {
        throw new Error("Game not dealt");
      }
      // check that every player is standing or busted
      const allPlayersStanding = game.players.every((player) => player.isDealer || player.isStanding || player.total > 21);
      if (!allPlayersStanding) {
        throw new Error("All players must stand or bust before revealing dealer hand");
      }

      const dealer = game.players.find((player) => player.isDealer)!;
      dealer.hand[0]!.isVisible = true;

      await gameDb.hset(input.gameId, game as unknown as Record<string, unknown>);

      return {
        ...game,
        players: game.players.map(transformPlayerHand),
      }
    }),
});
