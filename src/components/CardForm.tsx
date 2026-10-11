import {useState} from "react";
import MDEditor, {commands} from "@uiw/react-md-editor";
import {safePreview} from "./SafeMarkdown";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {SubmitButton} from "./SubmitButton.tsx";
import {type CardInput, CardInputSchema} from "../schemas/cardInput.ts";

export interface CardFormProps {
    initial?: Partial<CardInput>;
    values?: CardInput;
    onFieldChange?: (patch: Partial<CardInput>) => void;
    onSubmit: (input: CardInput) => Promise<void>;
    submittingText?: string;
    submitLabel?: string;
}

export default function CardForm({initial, values, onFieldChange, onSubmit, submittingText = "Creating...", submitLabel = "Create Card"}: CardFormProps) {
    const {control, handleSubmit, formState: {isSubmitting, errors}} =
        useForm<CardInput>({resolver: zodResolver(CardInputSchema), values});

    const [error, setError] = useState<string | null>(null);
  const formSubmit = handleSubmit(async (input) => {setError(null); try {await onSubmit(input);} catch (e) {setError(e instanceof Error ? e.message : String(e));}});

    return (
        <form onSubmit={formSubmit} className="space-y-4 pt-4">
            {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
            {Object.entries(errors).map(([key, value]) => <p key={key} role="alert" className="text-red-800">{key}: {value.message}</p>)}
            <div>
                <label htmlFor="front" className="block text-sm font-medium pb-4">
                    Front of Card
                </label>
                <div className='prose lg:prose-xl'>
                    <Controller
                        name='front'
                        control={control}
                        defaultValue={initial?.front}
                        render={({field: {onChange, value}}) => (
                            <MDEditor
                                commands={localCommands} id='front'
                                value={value}
                                onChange={next => {onChange(next ?? ""); onFieldChange?.({front: next ?? ""});}}
                                previewOptions={{
                                    ...safePreview
                                }}
                            />
                        )}
                    />
                </div>
            </div>
            <div>
                <label htmlFor="back" className="block text-sm font-medium pb-4">
                    Back of Card
                </label>
                <div className="prose lg:prose-xl">
                    <Controller
                        name='back'
                        control={control}
                        defaultValue={initial?.back}
                        render={({field: {onChange, value}}) => (
                            <MDEditor
                                commands={localCommands} id='back'
                                value={value}
                                onChange={next => {onChange(next ?? ""); onFieldChange?.({back: next ?? ""});}}
                                previewOptions={{
                                    ...safePreview
                                }}
                            />
                        )}
                    />
                </div>
            </div>
            <div className="pt-4">
                <SubmitButton isSubmitting={isSubmitting} text={submitLabel} submittingText={submittingText}/>
            </div>
        </form>
    )
}

const localCommands = commands.getCommands().map(command => command.name === "help" ? {...command, execute: () => {window.open("./markdown-help.html", "_blank", "noopener,noreferrer");}} : command);
