const publicBase = import.meta.env.BASE_URL || "/";

function asset(path: string) {
  return `${publicBase}${path.replace(/^\//, "")}`;
}

export const SCENES = [
  { id: "summit", label: "Вершина", image: asset("/wallpaper.jpg"), tone: "light" },
  { id: "dawn", label: "Рассвет", image: asset("/backgrounds/dawn.jpg"), tone: "light" },
  { id: "fjord", label: "Фьорд", image: asset("/backgrounds/fjord.jpg"), tone: "light" },
  { id: "night", label: "Ночь", image: asset("/backgrounds/night.jpg"), tone: "dark" },
  { id: "ink", label: "Море", image: asset("/backgrounds/ink.jpg"), tone: "dark" },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

export const SCENE_STORAGE_KEY = "base-ui-scene";

export function isSceneId(value: string | null): value is SceneId {
  return SCENES.some((scene) => scene.id === value);
}

export function sceneById(id: string | null | undefined) {
  return SCENES.find((scene) => scene.id === id) ?? SCENES[0];
}
