export type SelectValue = {
  id: number;
  value: string;
  color: string;
} | null;

export type LinkValue = {
  id: number;
  value: string;
};

export type FileValue = {
  url: string;
  name: string;
  visible_name?: string;
  is_image: boolean;
  mime_type?: string;
  thumbnails?: {
    small?: { url: string };
    card_cover?: { url: string };
  };
};

export type Task = {
  id: number;
  incrId: number | null;
  title: string;
  story: string;
  solution: string;
  clientComments: string;
  status: SelectValue;
  type: SelectValue;
  priority: SelectValue;
  clients: LinkValue[];
  assignees: LinkValue[];
  requesters: LinkValue[];
  sprint: LinkValue[];
  beSp: number | null;
  mbSp: number | null;
  adminSp: number | null;
  uiSp: number | null;
  spentSp: number | null;
  guideSp: number | null;
  eta: string | null;
  created: string | null;
  updated: string | null;
  impact: number | null;
  canLaunch: SelectValue;
  needsDecomp: SelectValue;
  refs: FileValue[];
};

export type Retailer = {
  id: number;
  name: string;
  industry: string | null;
  zone: string | null;
  product: string[];
  tariff: number | null;
};

export type Teammate = {
  id: number;
  name: string;
  role: string | null;
  squad: string | null;
  photo: string | null;
};

export type Sprint = {
  id: number;
  start: string | null;
  goal: string;
  achieved: string | null;
  taskCount: number;
};

export type BaseAccount = {
  connected: boolean;
  host: string;
  workspaceId: number | null;
  databaseId: number | null;
  backlog: number;
  retailers: number;
  team: number;
  hint: string;
  stored: "browser";
};

export type TasksPayload = {
  tasks: Task[];
  source: "public" | "token";
  /** recent = latest updates, search = whole-base text/person match, filtered = one person or client */
  scope: "recent" | "search" | "filtered";
  query: string;
  count: number;
  truncated: boolean;
  error?: string;
};
