export const BASEROW_ORIGIN = "https://base.imshop.io";

export const TABLES = {
  backlog: 757,
  retailers: 758,
  team: 759,
  sprints: 770,
} as const;

export const F = {
  incrId: "field_7240",
  status: "field_7199",
  client: "field_7198",
  assignee: "field_7206",
  created: "field_7214",
  title: "field_7196",
  story: "field_7200",
  type: "field_7197",
  sprint: "field_7213",
  requester: "field_7205",
  priority: "field_7203",
  refs: "field_7209",
  beSp: "field_7201",
  mbSp: "field_7202",
  spentSp: "field_7207",
  eta: "field_7210",
  updated: "field_7212",
  lastModified: "field_7215",
  impact: "field_7219",
  canLaunch: "field_7224",
  needsDecomp: "field_7225",
  adminSp: "field_7230",
  solution: "field_7232",
  clientComments: "field_7251",
  uiSp: "field_7235",
  guideSp: "field_7270",
} as const;

export const RETAILER_F = {
  name: "field_7274",
  industry: "field_7289",
  zone: "field_7426",
  product: "field_7279",
  tariff: "field_7283",
} as const;

export const TEAM_F = {
  name: "field_7477",
  role: "field_7480",
  squad: "field_7495",
  photo: "field_7483",
} as const;

export const SPRINT_F = {
  start: "field_7646",
  goal: "field_7647",
  backlog: "field_7650",
  achieved: "field_7649",
} as const;

export const BACKLOG_INCLUDE = Object.values(F).join(",");
export const RETAILER_INCLUDE = Object.values(RETAILER_F).join(",");
export const TEAM_INCLUDE = Object.values(TEAM_F).join(",");
export const SPRINT_INCLUDE = Object.values(SPRINT_F).join(",");

export const STATUSES = [
  { id: 3115, value: "Требует оценки", color: "light-orange" },
  { id: 3114, value: "Оценено/ждет оплаты", color: "dark-orange" },
  { id: 3116, value: "Оценено/нужно ревью на PBR", color: "light-yellow" },
  { id: 3117, value: "Next sprint", color: "light-purple" },
  { id: 3110, value: "Todo", color: "light-red" },
  { id: 3111, value: "In progress", color: "dark-orange" },
  { id: 3113, value: "Review", color: "light-blue" },
  { id: 3123, value: "Deploy", color: "dark-blue" },
  { id: 3128, value: "В работе у клиента", color: "light-green" },
  { id: 3112, value: "Done", color: "dark-blue" },
  { id: 3125, value: "Запрос продукту", color: "light-gray" },
  { id: 3126, value: "Недостаточно требований", color: "dark-gray" },
  { id: 3121, value: "Заблокировано клиентом", color: "dark-red" },
  { id: 3129, value: "Заблокировано во имя цели", color: "dark-red" },
  { id: 3118, value: "Невозможно реализовать", color: "dark-gray" },
  { id: 3119, value: "Отменен", color: "dark-gray" },
  { id: 3120, value: "Технический дубликат", color: "light-gray" },
  { id: 3124, value: "Не соответствует DoR", color: "light-orange" },
  { id: 3127, value: "Требует оценки влияния", color: "light-yellow" },
] as const;

export const BOARD_COLUMNS = [
  "Todo",
  "In progress",
  "Next sprint",
  "Review",
  "Deploy",
  "Done",
] as const;

export const TYPES = [
  { id: 3077, value: "Баг" },
  { id: 3078, value: "Техдолг" },
  { id: 3081, value: "Улучшение" },
  { id: 3076, value: "Гипотеза" },
  { id: 3079, value: "История" },
  { id: 3083, value: "Задача на запуск" },
  { id: 3084, value: "Улучшение продаж" },
  { id: 3080, value: "Настройка" },
  { id: 3082, value: "Поддержка" },
  { id: 3086, value: "Интеграция" },
  { id: 3087, value: "Маркетинг" },
  { id: 3099, value: "Цель спринта" },
  { id: 3100, value: "Задача по цели" },
  { id: 3101, value: "Запуск клиента" },
] as const;

export const PRIORITIES = [
  { id: 3130, value: "Must" },
  { id: 3131, value: "Should" },
  { id: 3132, value: "Could" },
  { id: 3133, value: "Would" },
] as const;

export const TOKEN_STORAGE_KEY = "base-ui-token";
