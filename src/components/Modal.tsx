import React, {useEffect, useId, useRef} from "react";
import {createPortal} from "react-dom";

export function Modal({
                          open,
                          onClose,
                          title,
                          children,
                          reading = false,
                          footer,
                          contentKey,
                      }: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    reading?: boolean;
    footer?: React.ReactNode;
    contentKey?: string;
}) {
    const labelId = useId();
    const dialog = useRef<HTMLDivElement>(null);
    const body = useRef<HTMLDivElement>(null);
    useEffect(() => {if (body.current) body.current.scrollTop = 0;}, [contentKey, open]);
    const close = useRef(onClose);
    useEffect(() => {close.current = onClose;}, [onClose]);
    useEffect(() => {
        if (!open) return;
        const previousFocus = document.activeElement as HTMLElement | null;
        const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('*') ?? []).filter(element => element.matches('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') && !element.closest('[inert]'));
        const timer = setTimeout(() => focusable()[0]?.focus(), 0);
        function onKey(e: KeyboardEvent) {
            if (!open) return;
            if (e.key === "Escape") {e.preventDefault(); close.current();}
            if (e.key === "Tab") {const items = focusable(); const first = items[0]; const last = items.at(-1); if (e.shiftKey && document.activeElement === first) {e.preventDefault(); last?.focus();} else if (!e.shiftKey && document.activeElement === last) {e.preventDefault(); first?.focus();}}
        }
        document.addEventListener("keydown", onKey);
        return () => {clearTimeout(timer); document.removeEventListener("keydown", onKey); if (previousFocus?.isConnected) previousFocus.focus();};
    }, [open]);

    useEffect(() => {
        if (!open || !reading) return;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {document.body.style.overflow = overflow;};
    }, [open, reading]);

    if (!open) return null;

    const content = (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            ref={dialog} role="dialog" aria-labelledby={labelId}
            aria-modal="true"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40"
                onClick={onClose}
            />

            {/* Dialog */}
            <div
                className={`
                    relative z-10 w-full ${reading ? "card-reading-dialog" : "max-w-lg"}
                    max-h-[90vh]        /* don't exceed viewport */
                    rounded-2xl border border-slate-200 dark:border-slate-800
                    bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-xl
                    flex flex-col overflow-hidden
                `}
            >
                {/* Header (fixed within dialog) */}
                <div className="flex shrink-0 items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h2 id={labelId} className="text-base font-semibold">{title}</h2>
                    <button
                        onClick={onClose}
                        className={`rounded-lg ${reading ? "min-h-11 min-w-11 flex items-center justify-center" : "p-1"} text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400/50`}
                        aria-label="Close"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            aria-hidden
                        >
                            <path
                                d="M6 6l12 12M18 6L6 18"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>

                {/* Body (scrollable when content is tall) */}
                <div ref={body} className={`min-h-0 flex-1 overflow-y-auto px-6 py-4 ${reading ? "card-reading-content" : ""}`} tabIndex={reading ? 0 : undefined} role={reading ? "region" : undefined} aria-label={reading ? "Full card text" : undefined}>
                    {children}
                </div>

                {footer && <div className="shrink-0 border-t border-slate-100 px-6 py-4">{footer}</div>}

            </div>
        </div>
    );
    return reading ? createPortal(content, document.body) : content;
}
