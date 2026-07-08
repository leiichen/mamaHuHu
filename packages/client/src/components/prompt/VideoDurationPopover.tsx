// 视频时长选择弹层（受控）
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { PromptPopoverPanel } from "@/components/prompt/PromptPopoverPanel";
import { type PromptPopoverInteractionProps } from "@/components/prompt/promptPopoverUtils";
import { Slider } from "@/components/ui/slider";
import { usePopoverDismiss } from "@/hooks/usePopoverDismiss";
import { VIDEO_DURATION_MAX, VIDEO_DURATION_MIN } from "@/lib/generationOptions";
import { cn } from "@/lib/utils";

type VideoDurationPopoverProps = PromptPopoverInteractionProps & {
    // value 当前时长（秒）；undefined 表示未设定，回退展示「时长」
    value?: number;
    // onChange 选中时长回调
    onChange?: (seconds: number) => void;
    // onClear 清除时长回调（恢复为未设定）
    onClear?: () => void;
};

// 渲染视频时长选择弹层
export function VideoDurationPopover({
    interactionScope = "default",
    popoverPlacement = "top",
    value,
    onChange,
    onClear,
}: VideoDurationPopoverProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    // draft 弹层打开期间的本地草稿（滑块即时回显，确定时才提交）
    const [draft, setDraft] = useState<number>(value ?? VIDEO_DURATION_MIN);

    usePopoverDismiss(rootRef, open, () => setOpen(false), [panelRef]);

    // 打开弹层时，用当前受控值重置草稿，确保滑块从已设时长开始拖动
    useEffect(() => {
        if (open) {
            setDraft(value ?? VIDEO_DURATION_MIN);
        }
    }, [open, value]);

    // hasValue 是否已设时长（用于触发按钮样式）
    const hasValue = typeof value === "number";
    // selected 弹层内展示值：打开时用 draft（可拖动），关闭时回退受控 value
    const selected = open ? draft : (value ?? draft);

    // 切换弹层开关
    const handleToggleOpen = () => {
        setOpen((current) => !current);
    };

    // 滑块拖动：更新本地 draft
    const handleValueChange = (values: number[]) => {
        setDraft(values[0] ?? VIDEO_DURATION_MIN);
    };

    // 确认选中时长并关闭弹层
    const handleConfirm = () => {
        onChange?.(draft);
        setOpen(false);
    };

    // 清除时长并关闭弹层
    const handleClear = () => {
        setDraft(VIDEO_DURATION_MIN);
        onClear?.();
        setOpen(false);
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={handleToggleOpen}
                className={cn(
                    "inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-2 text-xs transition",
                    hasValue
                        ? open
                            ? "bg-violet-50 text-violet-700"
                            : "bg-violet-50/60 text-violet-700"
                        : open
                          ? "bg-slate-100 text-slate-700"
                          : "text-slate-500 hover:bg-slate-100",
                )}
            >
                <Clock className="size-3.5 text-slate-400" strokeWidth={1.8} />
                {hasValue ? `${value}s` : "时长"}
                <ChevronDown
                    className={cn("size-3.5 text-slate-400 transition", open ? "rotate-180" : "")}
                    strokeWidth={1.8}
                />
            </button>

            <PromptPopoverPanel
                open={open}
                triggerRef={rootRef}
                panelRef={panelRef}
                interactionScope={interactionScope}
                popoverPlacement={popoverPlacement}
                widthClassName="w-[300px]"
            >
                <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">视频时长</p>
                    <div className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                        {selected}
                        <span className="ml-0.5 text-slate-500">秒</span>
                    </div>
                </div>
                <Slider
                    min={VIDEO_DURATION_MIN}
                    max={VIDEO_DURATION_MAX}
                    step={1}
                    value={[selected]}
                    onValueChange={handleValueChange}
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                        type="button"
                        disabled={!onClear}
                        onClick={handleClear}
                        className={cn(
                            "inline-flex h-8 cursor-pointer items-center rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50",
                            !onClear && "cursor-not-allowed opacity-40",
                        )}
                    >
                        清除
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="inline-flex h-8 cursor-pointer items-center rounded-full bg-black px-4 text-xs font-medium text-white transition hover:bg-black/85"
                    >
                        确定
                    </button>
                </div>
            </PromptPopoverPanel>
        </div>
    );
}
