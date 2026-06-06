// Shared mock setup for TUI component tests
import { mock } from "bun:test"

const defaultThemeColors = {
  primary: "#007acc",
  secondary: "#6c71c4",
  accent: "#2aa198",
  error: "#ff0000",
  warning: "#ffaa00",
  success: "#00ff00",
  info: "#268bd2",
  text: "#ffffff",
  textMuted: "#808080",
  selectedListItemText: "#000000",
  background: "#000000",
  backgroundPanel: "#111111",
  backgroundElement: "#1a1a1a",
  backgroundMenu: "#1a1a1a",
  border: "#333333",
  borderActive: "#555555",
  borderSubtle: "#222222",
  diffAdded: "#00ff00",
  diffRemoved: "#ff0000",
  diffContext: "#808080",
  diffHunkHeader: "#6c71c4",
  diffHighlightAdded: "#00ff00",
  diffHighlightRemoved: "#ff0000",
  diffAddedBg: "#002200",
  diffRemovedBg: "#220000",
  diffContextBg: "#111111",
  diffLineNumber: "#555555",
  diffAddedLineNumberBg: "#003300",
  diffRemovedLineNumberBg: "#330000",
  markdownText: "#ffffff",
  markdownHeading: "#ffffff",
  markdownLink: "#007acc",
  markdownLinkText: "#007acc",
  markdownCode: "#2aa198",
  markdownBlockQuote: "#808080",
  markdownEmph: "#ffffff",
  markdownStrong: "#ffffff",
  markdownHorizontalRule: "#333333",
  markdownListItem: "#ffffff",
  markdownListEnumeration: "#ffffff",
  markdownImage: "#007acc",
  markdownImageText: "#007acc",
  markdownCodeBlock: "#2aa198",
  syntaxComment: "#808080",
  syntaxKeyword: "#6c71c4",
  syntaxFunction: "#268bd2",
  syntaxVariable: "#b58900",
  syntaxString: "#2aa198",
  syntaxNumber: "#d33682",
  syntaxType: "#b58900",
  syntaxOperator: "#ffffff",
  syntaxPunctuation: "#808080",
  _hasSelectedListItemText: false,
  thinkingOpacity: 0.6,
}

export function mockTheme(overrides?: Record<string, any>) {
  const themeData = { ...defaultThemeColors, ...overrides }
  mock.module("@tui/context/theme", () => ({
    useTheme: () => ({
      theme: themeData,
      get selected() {
        return "opencode"
      },
      all() {
        return { opencode: {}, dracula: {}, nord: {} }
      },
      syntax: () => [],
      subtleSyntax: () => [],
      mode: () => "dark",
      setMode: () => {},
      set: () => {},
      get ready() {
        return true
      },
    }),
    DEFAULT_THEMES: { opencode: {}, dracula: {}, nord: {} },
    tint: (base: any, overlay: any, alpha: number) => base,
    selectedForeground: () => "#000000",
  }))
  return themeData
}

export function mockDialog() {
  const state = { cleared: false, replaced: false, size: "medium" as string }
  mock.module("@tui/ui/dialog", () => ({
    useDialog: () => ({
      clear() {
        state.cleared = true
      },
      replace() {
        state.replaced = true
      },
      stack: [],
      get size() {
        return state.size
      },
      setSize(s: string) {
        state.size = s
      },
    }),
  }))
  return state
}

export function mockSync(overrides?: Record<string, any>) {
  const data = {
    status: "complete",
    provider: [],
    provider_default: {},
    provider_next: { data: [], all: [] },
    provider_auth: {},
    agent: [
      { name: "build", description: "Build agent", native: true, mode: "agent", hidden: false },
      { name: "plan", description: "Plan agent", native: true, mode: "agent", hidden: false },
    ],
    command: [],
    permission: {},
    question: {},
    config: {},
    session: [],
    session_status: {},
    session_diff: {},
    todo: {},
    message: {},
    part: {},
    snapshot: {},
    lsp: {},
    mcp: {},
    mcp_resource: {},
    formatter: {},
    vcs: {},
    workspace: [],
    ...overrides,
  }
  mock.module("@tui/context/sync", () => ({
    useSync: () => ({ data }),
  }))
  return data
}

export function mockSDK(overrides?: Record<string, any>) {
  const sdkState = {
    url: "http://localhost:4096",
    client: {
      session: {
        list: async () => ({ data: [] }),
        delete: async () => {},
      },
      app: {
        skills: async () => ({ data: [] }),
      },
      ...overrides?.client,
    },
    fetch: async () => ({ json: () => ({}) }),
    ...overrides,
  }
  mock.module("@tui/context/sdk", () => ({
    useSDK: () => sdkState,
  }))
  return sdkState
}

export function mockLocal(overrides?: Record<string, any>) {
  const localState = {
    agent: {
      list: () => [
        { name: "build", description: "Build agent", native: true },
        { name: "plan", description: "Plan agent", native: true },
      ],
      current: () => ({ name: "build", description: "Build agent", native: true }),
      set: () => {},
      move: () => {},
      color: () => "#007acc",
    },
    model: {
      current: () => ({ providerID: "anthropic", modelID: "claude-sonnet" }),
      set: () => {},
      favorite: () => [],
      recent: () => [],
      toggleFavorite: () => {},
    },
    ...overrides,
  }
  mock.module("@tui/context/local", () => ({
    useLocal: () => localState,
  }))
  return localState
}

export function mockRoute(overrides?: Record<string, any>) {
  const routeState = {
    data: { type: "home" as string },
    navigate: () => {},
    ...overrides,
  }
  mock.module("@tui/context/route", () => ({
    useRoute: () => routeState,
    useRouteData: () => routeState.data,
  }))
  return routeState
}

export function mockKeybind() {
  mock.module("@tui/context/keybind", () => ({
    useKeybind: () => ({
      all: {},
      print: () => "",
      leader: false,
    }),
  }))
}

export function mockKV() {
  mock.module("@tui/context/kv", () => ({
    useKV: () => ({
      get: (key: string, fallback?: any) => fallback,
      set: () => {},
      ready: true,
      store: {},
    }),
  }))
}

export function mockToast() {
  mock.module("@tui/ui/toast", () => ({
    Toast: () => null,
    useToast: () => ({
      show: () => {},
      currentToast: null,
    }),
  }))
}

export function mockDialogSelect() {
  // Mock the DialogSelect component to just render its title and options as text
  mock.module("@tui/ui/dialog-select", () => ({
    DialogSelect: (props: any) => {
      const options = props.options ?? []
      return (
        <box flexDirection="column">
          <text>{props.title}</text>
          {options.map((opt: any) => (
            <text>
              {opt.title}
              {opt.description ? ` ${opt.description}` : ""}
            </text>
          ))}
        </box>
      )
    },
  }))
}

/**
 * Setup all common mocks for TUI dialog tests.
 * Call this BEFORE dynamically importing the component under test.
 */
export function setupMocks(overrides?: {
  sync?: Record<string, any>
  sdk?: Record<string, any>
  local?: Record<string, any>
  route?: Record<string, any>
  theme?: Record<string, any>
}) {
  mockTheme(overrides?.theme)
  mockDialog()
  mockSync(overrides?.sync)
  mockSDK(overrides?.sdk)
  mockLocal(overrides?.local)
  mockToast()
  mockRoute(overrides?.route)
  mockKeybind()
  mockKV()
  mockDialogSelect()
}
