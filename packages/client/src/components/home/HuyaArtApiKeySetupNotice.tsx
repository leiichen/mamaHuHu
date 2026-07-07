// 全局 API Key 配置提醒：服务端未配置时在右上角展示 Notice
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchHuyaArtApiKeyStatus, fetchOpenaiApiKeyStatus } from "@/api/config";
import { TopRightNotice } from "@/components/ui/top-right-notice";
import {
    HUYA_ART_API_KEY_CHANGED_EVENT,
    hasCustomHuyaArtApiKey,
} from "@/lib/huyaArtApiKeyStorage";
import {
    OPENAI_API_KEY_CHANGED_EVENT,
    hasCustomOpenaiApiKey,
} from "@/lib/openaiApiKeyStorage";
import { selectIsAuthenticated } from "@/store/authSlice";
import { useAppSelector } from "@/store/hooks";

// 渲染全局 API Key 配置提醒
export function HuyaArtApiKeySetupNotice() {
    const isAuthenticated = useAppSelector(selectIsAuthenticated);
    // serverHuyaArtConfigured 服务端是否已配置虎牙 art API Key
    const [serverHuyaArtConfigured, setServerHuyaArtConfigured] = useState<boolean | null>(null);
    // serverOpenaiConfigured 服务端是否已配置 OpenAI API Key
    const [serverOpenaiConfigured, setServerOpenaiConfigured] = useState<boolean | null>(null);
    // hasClientHuyaArtKey 用户是否已在本地配置虎牙 art Key
    const [hasClientHuyaArtKey, setHasClientHuyaArtKey] = useState(hasCustomHuyaArtApiKey);
    // hasClientOpenaiKey 用户是否已在本地配置 OpenAI Key
    const [hasClientOpenaiKey, setHasClientOpenaiKey] = useState(hasCustomOpenaiApiKey);
    // dismissed 用户是否已手动关闭本次会话提醒
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            setServerHuyaArtConfigured(null);
            setServerOpenaiConfigured(null);
            return;
        }

        const controller = new AbortController();

        void Promise.all([
            fetchHuyaArtApiKeyStatus(controller.signal),
            fetchOpenaiApiKeyStatus(controller.signal),
        ])
            .then(([huyaArtStatus, openaiStatus]) => {
                setServerHuyaArtConfigured(huyaArtStatus.configured);
                setServerOpenaiConfigured(openaiStatus.configured);
            })
            .catch(() => {
                setServerHuyaArtConfigured(null);
                setServerOpenaiConfigured(null);
            });

        return () => {
            controller.abort();
        };
    }, [isAuthenticated]);

    useEffect(() => {
        const handleApiKeyChanged = () => {
            const nextHasClientHuyaArtKey = hasCustomHuyaArtApiKey();
            const nextHasClientOpenaiKey = hasCustomOpenaiApiKey();

            setHasClientHuyaArtKey(nextHasClientHuyaArtKey);
            setHasClientOpenaiKey(nextHasClientOpenaiKey);

            if (!nextHasClientHuyaArtKey && !nextHasClientOpenaiKey) {
                setDismissed(false);
            }
        };

        window.addEventListener(HUYA_ART_API_KEY_CHANGED_EVENT, handleApiKeyChanged);
        window.addEventListener(OPENAI_API_KEY_CHANGED_EVENT, handleApiKeyChanged);

        return () => {
            window.removeEventListener(HUYA_ART_API_KEY_CHANGED_EVENT, handleApiKeyChanged);
            window.removeEventListener(OPENAI_API_KEY_CHANGED_EVENT, handleApiKeyChanged);
        };
    }, []);

    // noticeMessage 根据缺失项组合提醒文案
    const noticeMessage = useMemo(() => {
        const missing: string[] = [];

        if (serverHuyaArtConfigured === false && !hasClientHuyaArtKey) {
            missing.push("虎牙 art API KEY");
        }

        if (serverOpenaiConfigured === false && !hasClientOpenaiKey) {
            missing.push("AI API KEY");
        }

        if (missing.length === 0) {
            return "";
        }

        return `服务端未配置 ${missing.join("、")}，请点击右上角设置按钮，在弹窗中填写对应 API KEY。`;
    }, [hasClientHuyaArtKey, hasClientOpenaiKey, serverHuyaArtConfigured, serverOpenaiConfigured]);

    // handleCloseNotice 手动关闭提醒
    const handleCloseNotice = useCallback(() => {
        setDismissed(true);
    }, []);

    const open = isAuthenticated && noticeMessage.length > 0 && !dismissed;

    return (
        <TopRightNotice
            message={noticeMessage}
            open={open}
            variant="warning"
            onClose={handleCloseNotice}
        />
    );
}
