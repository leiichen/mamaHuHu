// 新增图片风格弹窗：填写名称/提示词/预览图，预览图传七牛，风格存 localStorage
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchQiniuUploadToken } from "@/api/upload";
import { ModalShell } from "@/components/ui/modal-shell";
import { PillButton } from "@/components/ui/pill-button";
import { generateCustomStyleId, saveCustomImageStyle } from "@/lib/customImageStyles";
import { inferImageExtFromFilename, isValidImageFile } from "@/lib/imageUpload";
import { uploadFileToQiniu } from "@/lib/qiniuUpload";

type AddImageStyleDialogProps = {
    open: boolean;
    onClose: () => void;
};

// 渲染新增图片风格弹窗
export function AddImageStyleDialog({ open, onClose }: AddImageStyleDialogProps) {
    // label 风格名称
    const [label, setLabel] = useState("");
    // prompt 生图提示词
    const [prompt, setPrompt] = useState("");
    // file 选中的预览图文件
    const [file, setFile] = useState<File | null>(null);
    // previewBlobUrl 选中文件后的即时预览 URL
    const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
    // saving 提交中
    const [saving, setSaving] = useState(false);
    // errorMessage 表单错误提示
    const [errorMessage, setErrorMessage] = useState("");

    // 打开时重置表单
    useEffect(() => {
        if (!open) {
            return;
        }

        setLabel("");
        setPrompt("");
        setFile(null);
        setPreviewBlobUrl(null);
        setSaving(false);
        setErrorMessage("");
    }, [open]);

    // 选择预览图文件：校验并生成即时预览
    const handleSelectFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0] ?? null;

        if (selected && !isValidImageFile(selected)) {
            setErrorMessage("预览图格式不支持或超过 20MB");
            event.target.value = "";
            return;
        }

        setErrorMessage("");
        setFile(selected);

        if (previewBlobUrl) {
            URL.revokeObjectURL(previewBlobUrl);
        }

        setPreviewBlobUrl(selected ? URL.createObjectURL(selected) : null);
    }, [previewBlobUrl]);

    // 提交新增风格
    const handleSubmit = useCallback(async () => {
        const trimmedLabel = label.trim();
        const trimmedPrompt = prompt.trim();

        if (!trimmedLabel || !trimmedPrompt || saving) {
            return;
        }

        setSaving(true);
        setErrorMessage("");

        try {
            const id = generateCustomStyleId(trimmedLabel);
            let previewKey: string | null = null;
            let blobUrl: string | undefined;

            if (file) {
                const ext = inferImageExtFromFilename(file.name);
                const tokenResult = await fetchQiniuUploadToken({ category: "image", ext });
                await uploadFileToQiniu({
                    uploadUrl: tokenResult.uploadUrl,
                    token: tokenResult.token,
                    objectKey: tokenResult.objectKey,
                    file,
                });
                previewKey = tokenResult.objectKey;
                blobUrl = previewBlobUrl ?? undefined;
            }

            saveCustomImageStyle(
                { id, label: trimmedLabel, prompt: trimmedPrompt, previewKey },
                blobUrl,
            );
            onClose();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "保存失败，请稍后重试");
        } finally {
            setSaving(false);
        }
    }, [file, label, onClose, previewBlobUrl, prompt, saving]);

    const canSubmit = label.trim() !== "" && prompt.trim() !== "" && !saving;

    return (
        <ModalShell open={open} onClose={onClose}>
            <h3 className="text-base font-semibold text-slate-900">新增风格</h3>
            <p className="mt-1 text-sm text-slate-500">填写风格名称、生图提示词与预览图</p>

            <label className="mt-4 block">
                <span className="mb-1.5 block text-xs text-slate-500">风格名称</span>
                <input
                    type="text"
                    value={label}
                    maxLength={30}
                    disabled={saving}
                    placeholder="如：赛博朋克2"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:opacity-60"
                    onChange={(event) => setLabel(event.target.value)}
                />
            </label>

            <label className="mt-3 block">
                <span className="mb-1.5 block text-xs text-slate-500">生图提示词</span>
                <textarea
                    value={prompt}
                    rows={3}
                    disabled={saving}
                    placeholder="描述画面风格，将拼入生图提示词"
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:opacity-60"
                    onChange={(event) => setPrompt(event.target.value)}
                />
            </label>

            <label className="mt-3 block">
                <span className="mb-1.5 block text-xs text-slate-500">预览图（可选）</span>
                <input
                    type="file"
                    accept="image/*"
                    disabled={saving}
                    className="w-full text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-60"
                    onChange={handleSelectFile}
                />
                {previewBlobUrl ? (
                    <img
                        src={previewBlobUrl}
                        alt="预览"
                        className="mt-2 h-24 w-auto rounded-lg border border-slate-200 object-contain"
                    />
                ) : null}
            </label>

            {errorMessage ? (
                <p className="mt-3 text-xs text-red-500">{errorMessage}</p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
                <PillButton variant="outline" disabled={saving} onClick={onClose}>
                    取消
                </PillButton>
                <PillButton disabled={!canSubmit} onClick={() => void handleSubmit()}>
                    {saving ? <Loader2 className="size-4 animate-spin" strokeWidth={2} /> : null}
                    保存
                </PillButton>
            </div>
        </ModalShell>
    );
}
