import {useEffect, useRef, useState} from 'react';
import {dataStore, type EditorSession} from './house';
import type {Card, Deck} from './model';

/** Local staging outlives navigation; observing forms redraw from the shared Room Draft. */
export function useEditorDraft(type: 'flashcard_deck' | 'flashcard_card', initial?: Deck | Card, deckId?: string, enabled = true) {
  const scope = `${type}:${initial?.id ?? 'new'}:${deckId ?? ''}:${enabled}`;
  const opening = useRef<{scope: string; promise: Promise<EditorSession>} | undefined>(undefined);
  const generation = useRef(0);
  const [state, setState] = useState<{scope: string; fields: Record<string, unknown>; error: string}>({scope, fields: initial ? {...initial} : {}, error: ''});
  const reasonText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
  useEffect(() => {
    const current = ++generation.current;
    if (!enabled) {opening.current = undefined; return;}
    let active = true;
    let session: EditorSession | undefined;
    let stop: (() => void) | undefined;
    const pending = dataStore.openEditor(type, initial, deckId);
    opening.current = {scope, promise: pending};
    void pending.then(value => {
      session = value;
      if (!active) {value.close(); return;}
      const update = (fields: Record<string, unknown>) => {
        if (active && generation.current === current) setState({scope, fields, error: value.error?.() ?? ''});
      };
      update(value.value()); stop = value.subscribe(update);
    }).catch(reason => {if (active && generation.current === current) setState({scope, fields: initial ? {...initial} : {}, error: reasonText(reason)});});
    return () => {active = false; stop?.(); session?.close();};
  }, [type, initial, deckId, enabled, scope]);
  return {
    fields: state.scope === scope ? state.fields : initial ? {...initial} : {},
    error: state.scope === scope ? state.error : '',
    write(patch: Record<string, unknown>) {
      const current = generation.current;
      setState(previous => ({scope, fields: {...(previous.scope === scope ? previous.fields : initial ?? {}), ...patch}, error: previous.scope === scope ? previous.error : ''}));
      const pending = opening.current;
      if (!pending || pending.scope !== scope) {setState(previous => ({...previous, error: 'The local editor is not ready.'})); return;}
      void pending.promise.then(session => session.write(patch)).then(() => {
        if (current === generation.current && opening.current?.scope === scope) setState(previous => ({...previous, error: ''}));
      }).catch(reason => {
        if (current === generation.current && opening.current?.scope === scope) setState(previous => ({...previous, error: reasonText(reason)}));
      });
    },
    async commit() {
      const pending = opening.current;
      if (!pending || pending.scope !== scope) throw new Error('The local editor is not ready.');
      return (await pending.promise).commit();
    },
  };
}
