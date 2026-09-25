/**
 * The chalk in the teacher's hand — the line being written, before it lands on the board.
 *
 * One owner (CLAUDE.md Law 5): the tray types into it, the board hands lines back into it for
 * correction, and recognition drops its confirmed reading into it. While the teacher writes, the
 * draft and the display move together so the dots are a live preview; committing hands the line
 * to the lesson store and empties the hand — the chalk stays on the board, not in the fist.
 */

import { create } from 'zustand';
import { useBraillix } from './store';
import { useLesson } from './lesson';
import { rememberInk } from './ink';

interface DraftState {
  /** What is in the input box. NOT what is on the board — see the header comment. */
  text: string;
  /** Which board line is being corrected, or null when writing the next one. */
  editing: number | null;
  /** Whether the ink strip — the board's writable next line — is open. */
  writing: boolean;
  /** The strokes behind the current draft, when it arrived by hand. Becomes the ghost ink. */
  pendingInk: string | null;

  /** The teacher typing: box and display move together, keystroke by keystroke. */
  setText: (text: string) => void;
  setWriting: (writing: boolean) => void;
  /** Pick a line off the board to correct it. */
  beginEdit: (index: number) => void;
  cancelEdit: () => void;
  /** The one commit path: Enter or the button. Appends, or saves the correction. */
  commit: () => void;
}

export const useDraft = create<DraftState>((set, get) => ({
  text: '',
  editing: null,
  writing: false,
  pendingInk: null,

  setWriting: (writing) => set({ writing }),

  setText: (text) => {
    // An emptied hand drops its ink too: a ghost belongs to the writing that produced the
    // draft, and a fresh draft typed from nothing has no handwriting behind it.
    set(text.trim() === '' ? { text, pendingInk: null } : { text });
    useBraillix.getState().setSource(text);
  },

  beginEdit: (index) => {
    const line = useLesson.getState().lines[index];
    if (!line) return;
    set({ editing: index, text: line.source });
    useLesson.getState().selectLine(index);
    useBraillix.getState().setSource(line.source);
  },

  cancelEdit: () => set({ editing: null, text: '' }),

  commit: () => {
    const { text, editing, pendingInk } = get();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (editing !== null) {
      useLesson.getState().editLine(editing, trimmed);
      set({ editing: null, text: '', pendingInk: null });
    } else {
      /*
       * A draft that came off the ink strip commits as recognised-and-confirmed: this press,
       * taken after seeing the print preview and the braille verdict, IS the confirmation the
       * lesson store's origin type demands. A hand-typed draft is simply typed.
       */
      useLesson.getState().addLine(trimmed, pendingInk ? { kind: 'recognised', confirmed: true } : { kind: 'typed' });
      const lines = useLesson.getState().lines;
      const landed = lines[lines.length - 1];
      if (pendingInk && landed) rememberInk(landed.id, pendingInk);
      set({ text: '', pendingInk: null });
    }
  },
}));
