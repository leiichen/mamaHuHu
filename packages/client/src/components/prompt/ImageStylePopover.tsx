// 图片风格选择弹层（画布生图面板）
import { useRef, useState, type ElementType } from "react";
import { Check, ChevronDown, Plus, Smile } from "lucide-react";
import { AddImageStyleDialog } from "@/components/prompt/AddImageStyleDialog";
import { PromptPopoverPanel } from "@/components/prompt/PromptPopoverPanel";
import { type PromptPopoverInteractionProps } from "@/components/prompt/promptPopoverUtils";
import { usePopoverDismiss } from "@/hooks/usePopoverDismiss";
import { getImageStyleLabel, useAllImageStyleOptions, type ImageStyleId } from "@/lib/imageStyles";
import { cn } from "@/lib/utils";

type ImageStylePopoverProps = PromptPopoverInteractionProps & {
    // value 选中的风格 ID；放宽为 string 以支持自定义风格（阶段一）
    value?: ImageStyleId | string;
    onValueChange?: (styleId: ImageStyleId | string | undefined) => void;
    panelTitle?: string;
    triggerFallbackLabel?: string;
    triggerIcon?: ElementType;
    triggerVariant?: "pill" | "toolbar";
    showDivider?: boolean;
};

// 渲染图片/视频风格选择弹层
export function ImageStylePopover({
    interactionScope = "default",
    popoverPlacement = "top",
    value,
    onValueChange,
    panelTitle = "图片风格",
    triggerFallbackLabel = "风格",
    triggerIcon,
    triggerVariant = "pill",
    showDivider = false,
}: ImageStylePopoverProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    // addDialogOpen 新增风格弹窗开关
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    // allOptions 合并内置与自定义风格的列表（自定义风格变化时自动刷新）
    const allOptions = useAllImageStyleOptions();
    const selectedOption = allOptions.find((option) => option.id === value) ?? null;
    const selectedLabel = selectedOption?.label ?? getImageStyleLabel(value);
    const triggerLabel = selectedLabel ?? triggerFallbackLabel;
    // TriggerIcon 触发按钮图标组件
    const TriggerIcon = triggerIcon ?? Smile;

    usePopoverDismiss(rootRef, open, () => setOpen(false), [panelRef]);

    // 切换弹层开关
    const handleToggleOpen = () => {
        setOpen((current) => !current);
    };

    // 选中风格并关闭弹层
    const handleSelectStyle = (styleId: ImageStyleId | string | undefined) => {
        onValueChange?.(styleId);
        setOpen(false);
    };

    return (
        <>
            <div ref={rootRef} className="relative">
                <button
                    type="button"
                    aria-expanded={open}
                    aria-haspopup="dialog"
                    onClick={handleToggleOpen}
                    className={cn(
                        "nodrag inline-flex cursor-pointer items-center gap-1 transition",
                        triggerVariant === "toolbar"
                            ? cn(
                                  "h-9 max-w-[140px] gap-1.5 px-3 text-sm",
                                  open || selectedLabel
                                      ? "text-violet-700"
                                      : "text-slate-700 hover:text-slate-900",
                              )
                            : cn(
                                  "h-8 max-w-[140px] rounded-full px-3 text-sm",
                                  open || selectedLabel
                                      ? "bg-violet-50 text-violet-700"
                                      : "text-slate-700 hover:bg-slate-100",
                              ),
                    )}
                >
                    <TriggerIcon
                        className={cn(
                            "size-4 shrink-0",
                            triggerVariant === "toolbar"
                                ? "text-slate-500"
                                : "text-violet-500",
                        )}
                        strokeWidth={1.8}
                    />
                    <span className="truncate">{triggerLabel}</span>
                    <ChevronDown
                        className={cn(
                            "size-4 shrink-0 text-slate-400 transition",
                            triggerVariant === "toolbar" ? "size-3.5" : "",
                            open ? "rotate-180" : "",
                        )}
                        strokeWidth={triggerVariant === "toolbar" ? 2 : 1.8}
                    />
                </button>

                <PromptPopoverPanel
                open={open}
                triggerRef={rootRef}
                panelRef={panelRef}
                interactionScope={interactionScope}
                popoverPlacement={popoverPlacement}
                widthClassName="w-[380px]"
            >
                <p className="mb-2 text-sm font-medium text-slate-900">{panelTitle}</p>
                <div className="nowheel max-h-[420px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => handleSelectStyle(undefined)}
                            className={cn(
                                "relative inline-flex cursor-pointer items-center justify-center rounded-xl border px-2 py-2.5 text-xs leading-5 transition",
                                !value
                                    ? "border-violet-400 bg-violet-50 text-violet-700"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                            )}
                        >
                            {!value ? (
                                <Check
                                    className="absolute top-1.5 right-1.5 size-3 text-violet-500"
                                    strokeWidth={2.5}
                                />
                            ) : null}
                            无风格
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                setAddDialogOpen(true);
                            }}
                            className="relative inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-2 py-2.5 text-xs leading-5 text-slate-500 transition hover:border-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                            <Plus className="size-3.5" strokeWidth={2} />
                            新增风格
                        </button>
                        {allOptions.map((option) => {
                            const selected = value === option.id;

                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleSelectStyle(option.id)}
                                    className={cn(
                                        "relative aspect-4/3 cursor-pointer overflow-hidden rounded-xl border text-left transition",
                                        selected
                                            ? "border-violet-400 ring-1 ring-violet-400"
                                            : "border-slate-200 hover:border-slate-300",
                                    )}
                                >
                                    {option.previewUrl ? (
                                        <img
                                            src={option.previewUrl}
                                            alt={option.label}
                                            loading="lazy"
                                            className="size-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex size-full items-center justify-center bg-slate-100 text-xs text-slate-400">
                                            暂无预览
                                        </div>
                                    )}
                                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-2 pt-8 pb-2 text-center text-xs leading-5 text-white">
                                        {option.label}
                                    </span>
                                    {selected ? (
                                        <Check
                                            className="absolute top-1.5 right-1.5 size-3 rounded-full bg-white/90 text-violet-500"
                                            strokeWidth={2.5}
                                        />
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </PromptPopoverPanel>
            <AddImageStyleDialog
                open={addDialogOpen}
                onClose={() => setAddDialogOpen(false)}
            />
            </div>
            {showDivider ? <span className="h-4 w-px shrink-0 bg-slate-200" aria-hidden /> : null}
        </>
    );
}
