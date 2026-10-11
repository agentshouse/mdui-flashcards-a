import {useState} from 'react';
import type {Card} from '../data/model';
import {Modal} from './Modal';
import {SafeMarkdown} from './SafeMarkdown';

/** Read-only presentation: no editor, draft, Save, or review-schedule calls. */
export function CardReader({card, initialSide, onClose}: {
    card: Card;
    initialSide: 'front' | 'back';
    onClose: () => void;
}) {
    const [side, setSide] = useState(initialSide);
    const isQuestion = side === 'front';
    return <Modal open reading title="Full card" onClose={onClose} contentKey={side} footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-zinc-600">{isQuestion ? 'Question' : 'Answer'}</p>
            <button type="button" className="min-h-11 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800" onClick={() => setSide(isQuestion ? 'back' : 'front')}>
                {isQuestion ? 'Show answer' : 'Show question'}
            </button>
        </div>
    }>
        <div className="mb-6 flex gap-2" aria-label="Card side">
            <button type="button" aria-pressed={isQuestion} onClick={() => setSide('front')} className={`min-h-11 rounded-full border px-5 py-2 text-sm font-medium ${isQuestion ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>Question</button>
            <button type="button" aria-pressed={!isQuestion} onClick={() => setSide('back')} className={`min-h-11 rounded-full border px-5 py-2 text-sm font-medium ${!isQuestion ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>Answer</button>
        </div>
        <SafeMarkdown source={isQuestion ? card.front : card.back}/>
    </Modal>;
}
