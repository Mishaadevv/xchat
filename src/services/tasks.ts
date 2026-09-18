export interface Task {
  id: string;
  chatId: string;
  title: string;
  description: string;
  done: boolean;
  createdAt: Date;
}

const STORAGE_KEY = "zeqouxchat-tasks";

function load(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw).map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) })) : [];
  } catch { return []; }
}

function save(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export const taskService = {
  getAll: (chatId?: string | null) => {
    const tasks = load();
    return chatId ? tasks.filter((t) => t.chatId === chatId) : tasks;
  },

  add: (chatId: string, title: string, description: string = "") => {
    const tasks = load();
    const task: Task = {
      id: crypto.randomUUID(), chatId, title, description,
      done: false, createdAt: new Date(),
    };
    tasks.unshift(task);
    save(tasks);
    return task;
  },

  toggle: (id: string) => {
    const tasks = load();
    const task = tasks.find((t) => t.id === id);
    if (task) { task.done = !task.done; save(tasks); }
  },

  remove: (id: string) => {
    save(load().filter((t) => t.id !== id));
  },

  parseFromContent: (chatId: string, content: string): Task[] => {
    const created: Task[] = [];
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/[-*]\s*\[ \]\s*(.+)/);
      if (match) {
        const task = taskService.add(chatId, match[1].trim());
        created.push(task);
      }
    }
    return created;
  },

  clear: (chatId: string) => {
    save(load().filter((t) => t.chatId !== chatId));
  },
};
