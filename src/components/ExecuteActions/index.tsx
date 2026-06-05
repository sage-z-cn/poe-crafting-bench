import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button, message, Modal } from "antd";
import classNames from "classnames";
import { isEmpty } from "lodash";
import './index.css';
import useLastExecParam from "@/hooks/useLastExecParam";

interface ExecuteActionsProps {
    visible: boolean
    onExecutingChange: (executing: boolean) => void
}

export interface ExecuteActionsHandler {
    execute: (execParam: ExecParam) => void
}

const ExecuteActions = forwardRef<ExecuteActionsHandler, ExecuteActionsProps>((
    {
        visible,
        onExecutingChange,
    },
    ref
) => {
    const logRef = useRef<HTMLDivElement>(null);
    const [, setLastExecParam] = useLastExecParam();
    const [executeLog, setExecuteLog] = useState<string>('');

    useEffect(() => {
        const listener = (event: any, data: string) => {
            setExecuteLog(prev => prev + data.trim() + '\n');
            setTimeout(() => {
                if (logRef.current) {
                    logRef.current.scrollTop = logRef.current.scrollHeight;
                }
            }, 100);
        };
        window.ipcRenderer.on('execute-log', listener);
        return () => {
            window.ipcRenderer.off('execute-log', listener);
        }
    }, [])

    useImperativeHandle<ExecuteActionsHandler, ExecuteActionsHandler>(ref, (): ExecuteActionsHandler => ({
        execute: (execParam: ExecParam) => {
            const { patch, font, fontSizeDelta, minimapVisibility, cameraZoom } = execParam;
            if (isEmpty(patch) && isEmpty(font) && !fontSizeDelta && minimapVisibility === undefined && cameraZoom === undefined) {
                message.error('当前没有配置任何可以执行的内容').then();
                return;
            }
            Modal.confirm({
                title: '确认执行',
                content: (
                    <div>
                        <p>1. 请确认游戏客户端和其他可能读取游戏文件的工具已关闭</p>
                        <p>2. 开始执行后请耐心等待执行结果，提前关闭本工具可能导致游戏客户端损坏</p>
                    </div>
                ),
                okText: '继续',
                cancelText: '取消',
                onOk: () => {
                    onExecutingChange(true);
                    setExecuteLog('');
                    window.ipcRenderer.invoke('patch', execParam).then(code => {
                        setLastExecParam(execParam);
                        if (code === 0) {
                            message.success('执行成功').then();
                        } else {
                            message.error('执行失败').then()
                        }
                        onExecutingChange(false);
                    });
                }
            })
        }
    }), [])

    const openUrl = useCallback((url: string) => {
        window.ipcRenderer.invoke('open-external', url);
    }, []);

    return (
        <div className={classNames('execute-actions', { 'hidden': !visible })}>
            <div className="disclaimer">
                <div className="disclaimer-title">免责声明</div>
                <div className="disclaimer-content">
                    <div>1. 本工具开源免费，源码托管于
                        <a onClick={() => openUrl('https://gitee.com/sage9731/poe-crafting-bench')}>Gitee</a>
                        {' / '}
                        <a onClick={() => openUrl('https://github.com/sage-z-cn/poe-crafting-bench')}>GitHub</a>
                    </div>
                    <div>2. 修改游戏客户端存在封号风险，使用者自行承担后果</div>
                    <div>3. 工具不含任何恶意代码，如有疑虑可自行查阅源码编译</div>
                    <div>4. 游戏更新后补丁和字体都会失效，需下载新版本补丁重新安装或重新修改字体</div>
                    <div>5. 继续使用即视为同意以上声明</div>
                </div>
            </div>
            <div className="execute-result">
                <div className="execute-result-title">
                    <span>执行日志</span>
                </div>
                <div className="execute-log" ref={logRef}>{executeLog}</div>
            </div>
        </div>
    );
});

export default ExecuteActions;