type Card = {
  code: string;
  image: string;
  images: {
    svg: string;
    png: string;
  };
  value: string;
  suit: string;
  isVisible: boolean;
};

export type DealData = {
  success: boolean;
  deck_id: string;
  cards: Card[];
  remaining: number;
};

export type DeckData = {
  success: boolean;
  deck_id: string;
  shuffled: boolean;
  remaining: number;
};

export type Player = {
  name: string;
  hand: Card[];
  isDealer: boolean;
  total: number;
  isStanding: boolean;
}

export interface Game {
  id: number;
  name: string;
  deckId: string;
  dealt: boolean;
  players: Player[];
}