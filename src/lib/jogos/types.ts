export type MatchTeam = {
  name: string;
  logo: string | null;
  goals: number | null;
  penalties: number | null;
  winner: boolean;
};

export type MatchOdds = {
  home: number;
  draw: number;
  away: number;
  source: string;
  updatedAt: string | null;
};

export type Match = {
  id: number;
  date: string;
  timestamp: number;
  status: string;
  league: string;
  country: string;
  round: string | null;
  venue: string | null;
  home: MatchTeam;
  away: MatchTeam;
  odds: MatchOdds | null;
};

export type MatchFeed = {
  upcoming: Match[];
  recent: Match[];
  availability: "ready" | "unconfigured" | "unavailable" | "partial";
};

export type MatchSide = "home" | "away";

export type MatchPlayer = {
  name: string;
  number: number | null;
  position: string | null;
};

export type MatchDetails = Match & {
  referee: string | null;
  city: string | null;
  season: number | null;
  elapsed: number | null;
  extra: number | null;
  scores: { label: string; home: number | null; away: number | null }[];
  events: {
    side: MatchSide;
    minute: number | null;
    extra: number | null;
    label: string;
    player: string | null;
    relatedPlayer: string | null;
    type: "goal" | "card" | "substitution" | "var";
  }[];
  statistics: { label: string; home: string | null; away: string | null }[];
  lineups: {
    side: MatchSide;
    formation: string | null;
    coach: string | null;
    starters: MatchPlayer[];
    substitutes: MatchPlayer[];
  }[];
  players: {
    side: MatchSide;
    name: string;
    minutes: number | null;
    rating: string | null;
    goals: number | null;
    assists: number | null;
    saves: number | null;
  }[];
  fetchedAt: string;
};

export type MatchDetailsResult =
  | { availability: "ready"; match: MatchDetails }
  | { availability: "unconfigured" | "unavailable" | "not-found"; match: null };
