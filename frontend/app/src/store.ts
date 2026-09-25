/**
 * The single application store.
 *
 * These facts have exactly one owner here, per CLAUDE.md Law 5:
 *   · the display profile (how many cells, how they are wired)
 *   · the current translation and its semantic tree
 *   · the run of braille currently being read (whole expression, or one node of it)
 *   · the link to the display, and through it what the hardware is believed to be showing
 *   · the state of every optional capability
 *
 * Nothing else in the app may recompute any of these.
 */

import { create } from 'zustand';
import { DEFAULT_SIMULATED_CELLS } from './config';
import { renderFrame, windowFollowingCursor, type Frame } from './core/frame';
import { simulatedProfile, type BitOrder, type DisplayProfile } from './core/profile';
import { initSre, toSpeechText } from './core/sre-service';
import { toLatex, type MathInputIssue } from './core/mathinput';
import { modelStatus } from './recognise/status';
import { recogniser } from './recognise/shared';
import { warmWords } from './recognise/words';
import { hasWords, translateMixed, type BrailleCode, type MixedLine, type SegmentKind } from './core/mixed';
import { latexToMathml, translateLatex, type Translation } from './core/translate';
import { BLANK, dotsToMask, type DotMask, type DotNumber } from './core/braille';
import type { RefreshPlan } from './core/scheduler';
import {
  breadcrumb,
  buildTree,
  describeNode,
  firstChild,
  parentOf,
  renderNode,
  sibling,
  speakNode,
  type SemNode,
  type SemTree,
} from './core/tree';
import { DisplayLink } from './transport/link';
import { HttpPodTransport, type PodMode } from './transport/httppod';
import { WebSerialTransport, webSerialSupported } from './transport/webserial';
import { TransportError, type ButtonEvent, type TransportStatus } from './transport/types';
import { cancelSpeech, speak, speakSequence, speechAvailable, voiceFor, whenVoicesReady } from './ui/speech';
import { lang, translate } from './ui/i18n';

/* ------------------------------------------------------------------ capabilities */

export type CapabilityState = 'checking' | 'ready' | 'unavailable' | 'degraded';

export interface Capability {
  readonly state: CapabilityState;
  /** Why it is not ready. Present whenever state is not 'ready'. */
  readonly reason?: string;
  /** Something the user can actually do about it. */
  readonly fix?: string;
}

export type CapabilityId = 'sre' | 'speech' | 'recognition' | 'usb' | 'pod' | 'offline';

export type CapabilityMap = Record<CapabilityId, Capability>;

const INITIAL_CAPABILITIES: CapabilityMap = {
  sre: { state: 'checking' },
  speech: { state: 'checking' },
  recognition: { state: 'checking' },
  usb: { state: 'checking' },
  pod: { state: 'unavailable', reason: 'simulated', fix: 'Connect real hardware on the Hardware screen.' },
  // Set by the service-worker registration in main.tsx, which is the only thing that knows.
  offline: { state: 'checking' },
};

/* ------------------------------------------------------------------ view + settings */

export type ViewId = 'board' | 'device' | 'help';

/**
 * How the display is being driven.
 *   'whole'   — the entire expression, character by character. What a conventional display does.
 *   'explore' — one node of the semantic tree at a time, its children folded to ⠿.
 */
export type ReadMode = 'whole' | 'explore';

export interface Settings {
  speechOn: boolean;
  speechRate: number;
}

/* ------------------------------------------------------------------ the store */

interface BraillixState {
  view: ViewId;
  setView: (view: ViewId) => void;

  /* --- the display --- */
  profile: DisplayProfile;
  setCellCount: (count: number) => void;
  setBitOrder: (order: BitOrder) => void;
  setReversed: (reversed: boolean) => void;

  /* --- the link to hardware --- */
  linkStatus: TransportStatus;
  linkLabel: string;
  linkFirmware: string | null;
  linkError: string | null;
  linkFix: string | null;
  connectUsb: () => Promise<void>;
  connectPods: (hosts: string[], mode: PodMode) => Promise<void>;
  switchToSimulator: () => Promise<void>;
  homeDisplay: () => Promise<void>;
  /** Put an arbitrary run of cells on the display — used by calibration and by practice drills. */
  showCells: (cells: readonly DotMask[], announcement: string) => void;
  /** Raise exactly one dot on every cell — the calibration test for cam bit order. */
  testDot: (dot: DotNumber | null) => Promise<void>;
  testingDot: DotNumber | null;

  /** Exactly what the teacher typed — natural maths, LaTeX, or a mixture. */
  source: string;
  /** The LaTeX it became. Derived, never typed into directly. */
  latex: string;
  /** What the input parser could not make sense of. Never fatal; always said out loud. */
  inputIssues: readonly MathInputIssue[];
  translation: Translation | null;
  /**
   * Set when the line contains words as well as maths — a textbook question rather than an
   * expression. Null for a pure expression, which is the case everything else in the app assumes.
   */
  mixedLine: MixedLine | null;
  /** The teacher's corrections to the words/maths split, keyed by the exact text of the segment. */
  segmentOverrides: Record<string, SegmentKind>;
  /** Switch one segment between words and maths, and re-render the line. */
  flipSegment: (text: string) => void;
  translating: boolean;
  /** Put an expression on the board, in whatever notation it was written. */
  setSource: (text: string, options?: SetSourceOptions) => void;
  setLatex: (latex: string) => void;
  /**
   * Page the reading window: through the panes of the current line first, and past its edge
   * into the neighbouring lesson line (via the registered edge pager). The ONE paging path —
   * pod buttons, on-screen arrows and keyboard all come here, so they cannot disagree.
   */
  page: (direction: -1 | 1) => void;
  /** Re-check which voice the current language has. Called when the language changes. */
  refreshSpeech: () => void;

  /* --- the reader --- */
  mode: ReadMode;
  setMode: (mode: ReadMode) => void;
  tree: SemTree | null;
  cursorId: string | null;
  foldedChildCells: readonly number[];
  foldReason: string | null;
  breadcrumb: string;
  nodeLabel: string;
  expanded: boolean;
  toggleExpanded: () => void;
  goSibling: (direction: -1 | 1) => void;
  goChild: () => void;
  goParent: () => void;
  enterFoldAt: (cellIndex: number) => void;
  canGo: { left: boolean; right: boolean; in: boolean; out: boolean };

  /** The braille run currently on the display — whole expression or one node. */
  activeCells: readonly DotMask[];
  /**
   * Which braille code each of those cells is written in, or null when the whole run is Nemeth.
   *
   * Only the evidence table needs this, and it needs it badly: without it, every cell of a Hindi
   * question was labelled with its Nemeth meaning, so a teacher reading the table was told that ⠛
   * meant "letter g" when it meant ग.
   */
  cellCodes: readonly BrailleCode[] | null;

  windowStart: number;
  cursor: number | null;
  setWindowStart: (start: number) => void;
  setCursor: (cursor: number | null) => void;

  frame: Frame;
  plan: RefreshPlan | null;
  planSummary: string;

  capabilities: CapabilityMap;
  setCapability: (id: CapabilityId, capability: Capability) => void;

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  sayCurrent: () => void;

  /**
   * What the speech engine would say for the current node, as text.
   *
   * Shown on screen because a machine without a Hindi voice installed can still demonstrate Hindi
   * output, and because a sighted teacher wants to see what the student is hearing.
   */
  spokenText: string;

  /** Announcement for the ARIA live region — every state change says what happened. */
  announcement: string;

  bootstrap: () => Promise<void>;
}

export interface SetSourceOptions {
  /** Speak the line once it is translated — a committed line lands on ears as well as fingers. */
  say?: boolean;
  /** Open on the LAST pane instead of the first — paging backwards into a line reads its end. */
  landAtEnd?: boolean;
}

/**
 * The link is not reactive state: it is a live connection with listeners and a belief about
 * physical hardware. The store holds exactly one, and replaces it when the transport changes.
 */
let link: DisplayLink | null = null;

/**
 * What paging past the edge of the current line does. The lesson store registers itself here
 * (dependency inversion — this store must not know the lesson exists, or the import cycles).
 * Returns true if it moved somewhere.
 */
let edgePager: ((direction: -1 | 1) => boolean) | null = null;

export function registerEdgePager(pager: (direction: -1 | 1) => boolean): void {
  edgePager = pager;
}

/** The window start that shows the final pane of a run of `total` cells. */
function lastPaneStart(total: number, cellCount: number): number {
  if (total <= cellCount) return 0;
  return Math.floor((total - 1) / cellCount) * cellCount;
}

const NO_CELLS: DotMask[] = [];

/** Speak one piece of mathematics — used when there is no tree to walk, only a line. */
async function speakMaths(latex: string, locale: 'en' | 'hi'): Promise<string> {
  const { mathml } = latexToMathml(latex);
  return toSpeechText(mathml, locale);
}

export const useBraillix = create<BraillixState>((set, get) => {
  /** Compute the frame for the current state. The one place a Frame is derived. */
  function frameFor(
    patch: Partial<Pick<BraillixState, 'profile' | 'activeCells' | 'windowStart' | 'cursor'>> = {},
  ): Frame {
    const state = { ...get(), ...patch };
    return renderFrame(state.profile, {
      cells: state.activeCells,
      windowStart: state.windowStart,
      cursor: state.cursor,
    });
  }

  /**
   * Send the frame to whatever display is attached and report what it cost.
   *
   * Deliberately fire-and-forget from the caller's point of view: a slow or sulking pod must never
   * make the interface unresponsive, and a failed push shows up as a visible error rather than as
   * a hang.
   */
  function pushFrame(frame: Frame): void {
    if (!link) return;
    void link.push(frame.cam).then((report) => {
      set({
        plan: report.plan,
        planSummary: report.summary,
        linkError: report.error ?? null,
        linkFix: report.fix ?? null,
      });
    });
  }

  /** Apply a patch, recompute the frame, and drive the display. */
  function project(patch: Partial<Pick<BraillixState, 'profile' | 'activeCells' | 'windowStart' | 'cursor'>> = {}) {
    const frame = frameFor(patch);
    pushFrame(frame);
    return { ...patch, frame };
  }

  function movement(tree: SemTree | null, cursorId: string | null) {
    if (!tree || !cursorId) return { left: false, right: false, in: false, out: false };
    return {
      left: sibling(tree, cursorId, -1) !== null,
      right: sibling(tree, cursorId, 1) !== null,
      in: firstChild(tree, cursorId) !== null,
      out: parentOf(tree, cursorId) !== null,
    };
  }

  /** Render the node the cursor is on and put it on the display. Announces and speaks it. */
  async function showNode(node: SemNode, options: { announce?: boolean } = {}): Promise<void> {
    const { tree, translation, expanded, settings } = get();
    if (!tree || !translation) return;

    const rendering = await renderNode(translation.enriched, node, { fold: !expanded });
    if (get().cursorId !== node.id) return; // the reader moved on while we were translating

    const label = describeNode(tree, node);
    set({
      nodeLabel: label,
      breadcrumb: breadcrumb(tree, node.id),
      foldedChildCells: rendering.childCellIndex,
      foldReason: rendering.folded ? null : (rendering.reason ?? null),
      canGo: movement(tree, node.id),
      announcement:
        options.announce === false
          ? get().announcement
          : translate('say.node', { label, count: rendering.cells.length }),
      cellCodes: null,
      ...project({ activeCells: rendering.cells, windowStart: 0, cursor: null }),
    });

    // Always compute the transcript, even with speech switched off — it is shown on screen.
    const spoken = await speakNode(node, lang());
    if (get().cursorId !== node.id) return;
    set({ spokenText: spoken });
    if (settings.speechOn && options.announce !== false) {
      speak(`${label}. ${spoken}`, lang(), settings.speechRate);
    }
  }

  function moveTo(node: SemNode | null): void {
    if (!node) return;
    set({ cursorId: node.id });
    void showNode(node);
  }

  /** Pod buttons drive the same navigation as the arrow keys — see docs/PROTOCOL.md §5. */
  function handlePodButton(event: ButtonEvent): void {
    const { mode } = get();
    if (mode !== 'explore') {
      // In whole-line mode the buttons walk the lesson the way a finger walks a blackboard:
      // through the panes of this line, then on to the next line of the working.
      if (event.button === 'prev') get().page(-1);
      if (event.button === 'next') get().page(1);
      if (event.button === 'select') get().sayCurrent();
      return;
    }
    if (event.button === 'prev') get().goSibling(-1);
    else if (event.button === 'next') get().goSibling(1);
    else if (event.long) get().goParent();
    else get().goChild();
  }

  /** Swap in a new display link, adopting the calibration settings the user already chose. */
  async function adopt(next: DisplayLink, capability: Capability): Promise<void> {
    const previous = link;
    link = next;
    if (previous) await previous.close().catch(() => {});

    next.onButton(handlePodButton);
    next.onStatus((status, reason) => {
      set({ linkStatus: status, linkError: reason ?? null });
    });

    const { profile } = get();
    const nextProfile = next.profile(profile);

    set({
      profile: nextProfile,
      linkStatus: next.status,
      linkLabel: next.transport.label,
      linkFirmware: next.chain.firmware ?? null,
      linkError: null,
      linkFix: null,
      announcement:
        nextProfile.cellCount === 1
          ? translate('say.displayOne', { label: next.transport.label })
          : translate('say.display', { count: nextProfile.cellCount, label: next.transport.label }),
      ...project({ profile: nextProfile }),
    });
    get().setCapability('pod', capability);
  }

  const initialProfile = simulatedProfile(DEFAULT_SIMULATED_CELLS);

  return {
    view: 'board',
    setView: (view) => set({ view }),

    profile: initialProfile,
    setCellCount: (count) => {
      if (!link) return;
      try {
        link.resize(count);
      } catch (err) {
        set({ linkError: err instanceof Error ? err.message : String(err) });
        return;
      }
      const next = link.profile(get().profile);
      set({
        profile: next,
        announcement: count === 1 ? translate('say.cellsNowOne') : translate('say.cellsNow', { count }),
        ...project({ profile: next }),
      });
    },
    setBitOrder: (order) => {
      const { profile } = get();
      const next = simulatedProfile(profile.cellCount, { ...profile, bitOrder: order });
      link?.invalidate(); // the wire meaning of every cell changed
      set({ profile: next, ...project({ profile: next }) });
    },
    setReversed: (reversed) => {
      const { profile } = get();
      const next = simulatedProfile(profile.cellCount, { ...profile, reversed });
      link?.invalidate();
      set({ profile: next, ...project({ profile: next }) });
    },

    /* --- the link --- */
    linkStatus: 'disconnected',
    linkLabel: 'simulated',
    linkFirmware: null,
    linkError: null,
    linkFix: null,
    testingDot: null,

    switchToSimulator: async () => {
      const next = await DisplayLink.simulated(get().profile.cellCount);
      await adopt(next, {
        state: 'ready',
        reason: 'simulated — no hardware attached',
      });
    },

    connectUsb: async () => {
      if (!webSerialSupported()) {
        set({
          linkError: 'Web Serial is not supported in this browser',
          linkFix: 'Use Chrome or Edge on a desktop, or connect over Wi-Fi.',
        });
        return;
      }
      const transport = new WebSerialTransport();
      try {
        const chain = await transport.connect();
        await adopt(new DisplayLink(transport, chain), {
          state: 'ready',
          reason: `${chain.cellCount} cells over USB · ${chain.firmware ?? 'unknown firmware'}`,
        });
      } catch (err) {
        set({
          linkError: err instanceof Error ? err.message : String(err),
          linkFix: err instanceof TransportError ? (err.fix ?? null) : null,
        });
      }
    },

    connectPods: async (hosts, mode) => {
      const cleaned = hosts.map((h) => h.trim()).filter(Boolean);
      if (cleaned.length === 0) {
        set({ linkError: 'enter at least one pod address', linkFix: 'For example 192.168.1.42' });
        return;
      }
      try {
        const transport = new HttpPodTransport({ hosts: cleaned, mode });
        const chain = await transport.connect();
        await adopt(new DisplayLink(transport, chain), {
          state: 'ready',
          reason: `${chain.cellCount} cells over Wi-Fi · ${chain.pods.length} pod${chain.pods.length === 1 ? '' : 's'}${mode === 'mirror' ? ' · all showing the same' : ''}`,
        });
      } catch (err) {
        set({
          linkError: err instanceof Error ? err.message : String(err),
          linkFix: err instanceof TransportError ? (err.fix ?? null) : null,
        });
      }
    },

    homeDisplay: async () => {
      if (!link) return;
      await link.home();
      set({ announcement: translate('say.homed'), ...project() });
    },

    /**
     * Calibration: raise exactly one dot on every cell.
     *
     * This is the ten-second answer to the one thing the hardware handoff flags as unconfirmed —
     * whether dot 1 really drives cam track 0. Press "dot 1"; if the physical cell raises a
     * different dot, fix the mapping here rather than re-flashing anything.
     */
    showCells: (cells, announcement) => {
      set({
        testingDot: null,
        announcement,
        cellCodes: null,
        ...project({ activeCells: [...cells], windowStart: 0, cursor: null }),
      });
    },

    testDot: async (dot) => {
      const { profile } = get();
      const mask = dot === null ? BLANK : dotsToMask([dot]);
      const cells = new Array<DotMask>(profile.cellCount).fill(mask);
      set({
        testingDot: dot,
        announcement: dot === null ? translate('say.testCleared') : translate('say.testDot', { dot }),
        cellCodes: null,
        ...project({ activeCells: cells, windowStart: 0, cursor: null }),
      });
    },

    source: '',
    latex: '',
    inputIssues: [],
    translation: null,
    mixedLine: null,
    segmentOverrides: {},
    translating: false,

    flipSegment: (text) => {
      const current = get().segmentOverrides;
      const segment = get().mixedLine?.segments.find((entry) => entry.text === text);
      if (!segment) return;
      const next = { ...current, [text]: segment.kind === 'maths' ? ('text' as const) : ('maths' as const) };
      set({ segmentOverrides: next });
      get().setSource(get().source);
    },

    /**
     * Put an expression on the board.
     *
     * One entry point for every source — the keyboard, the keypad, the recogniser, a worksheet —
     * so that natural maths and LaTeX cannot diverge into two pipelines with two sets of bugs.
     * `toLatex` passes LaTeX through untouched, so this is safe for callers that already have it.
     */
    setSource: (text, options = {}) => {
      /*
       * A line with words in it is a textbook question, not an expression: it needs two braille
       * codes and a visible boundary between them (core/mixed.ts). A line without words takes
       * exactly the path it always has, so nothing that already worked can change.
       *
       * The maths parser is not run over a question at all. It used to be — for the print preview —
       * and it complained about every letter of every word, so a perfectly good Bengali question
       * arrived under sixteen warnings about characters it could not use in an expression. The
       * issues that matter for a question come from its segments, which is where they are read from
       * below.
       */
      const words = hasWords(text);
      const parsed = words ? { latex: '', issues: [] } : toLatex(text);
      set({ source: text, latex: parsed.latex, inputIssues: parsed.issues, translating: true, testingDot: null });

      if (words) {
        void translateMixed(text, get().segmentOverrides).then((line) => {
          if (get().source !== text) return;
          const start = options.landAtEnd ? lastPaneStart(line.cells.length, get().profile.cellCount) : 0;
          set({
            translating: false,
            mixedLine: line,
            // A character with no cell must be visible, whichever half of the line it was in.
            inputIssues: line.segments
              .flatMap((segment) => segment.issues)
              .map((issue) => ({ message: issue.message, fix: issue.fix })),
            translation: null,
            tree: null,
            cursorId: null,
            breadcrumb: '',
            nodeLabel: '',
            canGo: { left: false, right: false, in: false, out: false },
            foldedChildCells: [],
            foldReason: null,
            mode: 'whole',
            announcement: translate('say.cells', { count: line.cells.length }),
            cellCodes: line.codes,
            ...project({ activeCells: line.cells, windowStart: start, cursor: null }),
          });
          if (options.say) get().sayCurrent();
        });
        return;
      }

      void translateLatex(parsed.latex).then((translation) => {
        if (get().source !== text) return; // a newer keystroke already won
        const start = options.landAtEnd
          ? lastPaneStart(translation.cells.length, get().profile.cellCount)
          : 0;

        const tree = buildTree(translation.enriched);
        const rootId = tree?.rootId ?? null;

        // If the maths engine died, the cells now carry LITERARY braille, not Nemeth. Say so in
        // the status strip as well as inline — a display quietly showing a different braille code
        // is the most dangerous kind of silent failure this product could have.
        if (translation.degraded === 'literal') {
          get().setCapability('sre', {
            state: 'degraded',
            reason: 'unavailable — cells show Grade-1 literary braille, NOT Nemeth',
            fix: 'Reload; if it persists run `npm install` again to restore public/sre/mathmaps.',
          });
        }

        set({
          translating: false,
          translation,
          mixedLine: null,
          tree,
          cursorId: rootId,
          breadcrumb: tree && rootId ? breadcrumb(tree, rootId) : '',
          nodeLabel: tree && rootId ? describeNode(tree, tree.nodes.get(rootId)!) : '',
          canGo: movement(tree, rootId),
          foldedChildCells: [],
          foldReason: null,
          announcement: translation.issues.some((i) => i.kind === 'parse')
            ? translate('board.parseFailed')
            : translate('say.cells', { count: translation.cells.length }),
          cellCodes: null,
          ...project({ activeCells: translation.cells, windowStart: start, cursor: null }),
        });

        if (get().mode === 'explore' && tree && rootId) {
          void showNode(tree.nodes.get(rootId)!, { announce: false });
        } else if (options.say) {
          get().sayCurrent();
        }
      });
    },

    /** LaTeX is just one of the notations `setSource` understands. */
    setLatex: (latex) => get().setSource(latex),

    page: (direction) => {
      const { windowStart, profile, activeCells } = get();
      if (direction === -1 && windowStart > 0) {
        get().setWindowStart(Math.max(0, windowStart - profile.cellCount));
        return;
      }
      if (direction === 1 && windowStart + profile.cellCount < activeCells.length) {
        get().setWindowStart(windowStart + profile.cellCount);
        return;
      }
      // Past the edge of this line: on to the neighbouring line of the lesson, if there is one.
      edgePager?.(direction);
    },

    /* --- the reader --- */
    mode: 'whole',
    setMode: (mode) => {
      cancelSpeech();
      set({ mode });
      const { tree, translation, cursorId } = get();
      if (mode === 'explore' && tree && cursorId) {
        void showNode(tree.nodes.get(cursorId)!);
      } else if (translation) {
        set({
          foldedChildCells: [],
          foldReason: null,
          announcement: translate('say.whole', { count: translation.cells.length }),
          cellCodes: null,
          ...project({ activeCells: translation.cells, windowStart: 0, cursor: null }),
        });
      }
    },

    tree: null,
    cursorId: null,
    foldedChildCells: [],
    foldReason: null,
    breadcrumb: '',
    nodeLabel: '',
    expanded: false,
    toggleExpanded: () => {
      set({ expanded: !get().expanded });
      const { tree, cursorId, mode } = get();
      if (mode === 'explore' && tree && cursorId) {
        const node = tree.nodes.get(cursorId);
        if (node) void showNode(node);
      }
    },

    goSibling: (direction) => {
      const { tree, cursorId } = get();
      if (tree && cursorId) moveTo(sibling(tree, cursorId, direction));
    },
    goChild: () => {
      const { tree, cursorId } = get();
      if (tree && cursorId) moveTo(firstChild(tree, cursorId));
    },
    goParent: () => {
      const { tree, cursorId } = get();
      if (tree && cursorId) moveTo(parentOf(tree, cursorId));
    },
    enterFoldAt: (cellIndex) => {
      const { tree, cursorId, foldedChildCells } = get();
      if (!tree || !cursorId) return;
      const which = foldedChildCells.indexOf(cellIndex);
      if (which === -1) return;
      const childId = tree.nodes.get(cursorId)?.childIds[which];
      if (childId) moveTo(tree.nodes.get(childId) ?? null);
    },
    canGo: { left: false, right: false, in: false, out: false },

    activeCells: NO_CELLS,
    cellCodes: null,

    windowStart: 0,
    cursor: null,
    setWindowStart: (start) => set(project({ windowStart: start })),
    setCursor: (cursor) => {
      const state = get();
      const total = state.activeCells.length;
      if (cursor === null || total === 0) {
        set(project({ cursor: null }));
        return;
      }
      const clamped = Math.min(Math.max(cursor, 0), total - 1);
      const windowStart = windowFollowingCursor(state.windowStart, clamped, state.profile.cellCount, total);
      set(project({ cursor: clamped, windowStart }));
    },

    frame: renderFrame(initialProfile, { cells: NO_CELLS }),
    plan: null,
    planSummary: '',

    capabilities: INITIAL_CAPABILITIES,
    setCapability: (id, capability) =>
      set((state) => ({ capabilities: { ...state.capabilities, [id]: capability } })),

    settings: { speechOn: true, speechRate: 1 },
    updateSettings: (patch) => {
      cancelSpeech();
      set((state) => ({ settings: { ...state.settings, ...patch } }));
    },

    /**
     * The language changed, so the voice may have too.
     *
     * A machine with no Hindi voice is common — this laptop is one — and the honest thing is to say
     * so on the badge rather than to fall silent and let the teacher wonder what broke.
     */
    refreshSpeech: () => {
      cancelSpeech();
      const locale = lang();
      const voice = voiceFor(locale);
      const language = locale === 'hi' ? 'Hindi' : 'English';
      get().setCapability('speech', {
        state: voice.available ? 'ready' : 'degraded',
        reason: voice.available ? `${language} · ${voice.name ?? 'system voice'}` : `no ${language} voice on this machine`,
        fix: voice.available ? undefined : 'Braille is unaffected. Install the voice in your OS settings, or switch language.',
      });
      const { tree, cursorId, mode } = get();
      if (mode === 'explore' && tree && cursorId) {
        const node = tree.nodes.get(cursorId);
        if (node) void showNode(node, { announce: false });
      }
    },
    sayCurrent: () => {
      const { settings, mode, tree, cursorId, mixedLine } = get();
      if (!settings.speechOn) return;

      /*
       * A question with words in it has no expression tree to walk, so there is nothing for the
       * maths engine to speak. Reading it aloud is still exactly what a teacher wants — so the
       * words are spoken as words and the maths inside them as mathematics, in that order. Without
       * this the button was silent on precisely the lines a class most wants to hear.
       */
      if (mixedLine) {
        void Promise.all(
          mixedLine.segments.map(async (segment) => {
            // Devanagari words go to a Hindi voice whatever language the interface is in: an
            // English voice handed Devanagari says nothing a child can use.
            if (segment.kind !== 'maths' || !segment.latex) {
              return { text: segment.text, locale: segment.code === 'bharati' ? ('hi' as const) : lang() };
            }
            const spoken = await speakMaths(segment.latex, lang()).catch(() => segment.text);
            return { text: spoken, locale: lang() };
          }),
        ).then((parts) => {
          set({ spokenText: parts.map((part) => part.text).join(' ') });
          speakSequence(parts, settings.speechRate);
        });
        return;
      }

      if (!tree) return;
      const id = mode === 'explore' && cursorId ? cursorId : tree.rootId;
      const node = tree.nodes.get(id);
      if (!node) return;
      void speakNode(node, lang()).then((text) => {
        const prefix = mode === 'explore' ? `${describeNode(tree, node)}. ` : '';
        speak(`${prefix}${text}`, lang(), settings.speechRate);
      });
    },

    spokenText: '',
    announcement: '',

    /** Probe every optional capability once, at startup, and report each honestly. */
    bootstrap: async () => {
      const { setCapability } = get();

      // The simulated display is the baseline: the product must be complete with nothing attached.
      if (!link) await get().switchToSimulator();

      const sreStatus = await initSre();
      setCapability(
        'sre',
        sreStatus.ok
          ? { state: 'ready', reason: `Nemeth · SRE ${sreStatus.version ?? ''}`.trim() }
          : {
              state: 'unavailable',
              reason: sreStatus.reason ?? 'failed to start',
              fix: 'Run `npm install` again — the locale files in public/sre/mathmaps may be missing.',
            },
      );

      if (speechAvailable()) {
        await whenVoicesReady();
        const voice = voiceFor(lang());
        setCapability('speech', {
          state: voice.available ? 'ready' : 'degraded',
          reason: voice.available ? (voice.name ?? 'system voice') : 'no matching voice installed',
          fix: voice.available ? undefined : 'Braille is unaffected. Install a voice in your OS settings.',
        });
      } else {
        setCapability('speech', {
          state: 'unavailable',
          reason: 'this browser has no speech synthesis',
          fix: 'Braille and on-screen reading are unaffected.',
        });
      }

      setCapability(
        'usb',
        webSerialSupported()
          ? { state: 'ready', reason: 'Web Serial available' }
          : {
              state: 'unavailable',
              reason: 'Web Serial is not supported here',
              fix: 'Use Chrome or Edge on a desktop to connect a pod over USB.',
            },
      );

      // Ask the file `npm install` wrote rather than probing for a 404 — see recognise/status.ts.
      const model = await modelStatus();
      setCapability('recognition', {
        state: model.installed ? 'ready' : 'unavailable',
        reason: model.installed ? 'on this device, offline' : (model.reason ?? 'on-device model not installed'),
        fix: model.installed ? undefined : 'Run `npm run fetch:model` once (76 MB) to enable reading handwriting.',
      });

      /*
       * Warm the recognisers NOW, in the background, not when the teacher first presses Read.
       *
       * Measured cold on the deployed site: 64 seconds from button to result — model download,
       * WASM compile, worker boot, then inference. Warm: under a second. A teacher mid-lesson
       * cannot wait a minute, so the minute is spent here, while she is still reading the
       * greeting, with the badge saying honestly what is happening (Law 3, never silent).
       */
      if (model.installed && typeof Worker !== 'undefined') {
        window.setTimeout(() => {
          void recogniser
            .load((progress) => {
              setCapability('recognition', {
                state: 'checking',
                reason: translate('cap.warming', { pc: Math.round(progress * 100) }),
              });
            })
            .then(() => {
              setCapability('recognition', { state: 'ready', reason: translate('cap.warm') });
              return warmWords();
            })
            .catch((err: unknown) => {
              setCapability('recognition', {
                state: 'degraded',
                reason: err instanceof Error ? err.message : String(err),
                fix: 'Reload the page. Typing is unaffected.',
              });
            });
        }, 1500);
      }
    },
  };
});

/** Capabilities worth showing in the status strip, worst news first. */
export function rankedCapabilities(map: CapabilityMap): { id: CapabilityId; capability: Capability }[] {
  const rank: Record<CapabilityState, number> = { unavailable: 0, degraded: 1, checking: 2, ready: 3 };
  return (Object.keys(map) as CapabilityId[])
    .map((id) => ({ id, capability: map[id] }))
    .sort((a, b) => rank[a.capability.state] - rank[b.capability.state]);
}
