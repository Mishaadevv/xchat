import type { Project } from "@/core/types";

const STORAGE_KEY = "zeqouxchat-projects";

function load(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export const projectService = {
  getAll: () => load(),

  get: (id: string) => load().find((p) => p.id === id) ?? null,

  add: (name: string, path: string) => {
    const projects = load();
    const project: Project = { id: crypto.randomUUID(), name, path };
    projects.push(project);
    save(projects);
    return project;
  },

  remove: (id: string) => {
    save(load().filter((p) => p.id !== id));
  },

  update: (id: string, updates: Partial<Project>) => {
    const projects = load();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx !== -1) {
      projects[idx] = { ...projects[idx], ...updates };
      save(projects);
    }
  },
};
