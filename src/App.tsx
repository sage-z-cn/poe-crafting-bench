import { useCallback, useMemo, useRef, useState } from "react";
import { Button, Steps, message, Modal } from "antd";
import { FileZipOutlined, FolderOpenOutlined, FontSizeOutlined, RocketOutlined } from "@ant-design/icons";
import { StepProps } from "antd/es/steps";
import { isEmpty } from 'lodash';

import GameInstallPath from "@/components/GameInstallPath";
import PatchPath from "@/components/PatchPath";
import SelectFont from "@/components/SelectFont";
import ExecuteActions, { ExecuteActionsHandler } from "@/components/ExecuteActions";
import UpdateNotice from "@/components/UpdateNotice";

import './App.css'

interface CustomStepProps extends StepProps {
    key: 'path' | 'patch' | 'font' | 'hiddenFeatures' | 'execute'
}

function App() {
    const executeRef = useRef<ExecuteActionsHandler>(null);
    const [execParam, setExecParam] = useState<ExecParam>({ path: '' });
    const [executing, setExecuting] = useState(false);
    const [currentStep, setCurrentStep] = useState<number>(0);
    const steps: CustomStepProps[] = useMemo(() => {
        const disabled = currentStep === 0 && isEmpty(execParam.path) || executing;
        const steps: CustomStepProps[] = [
            {
                key: 'path',
                title: '选择游戏目录',
                icon: <FolderOpenOutlined/>,
                disabled: executing,
            },
            {
                key: 'patch',
                title: '选择补丁',
                icon: <FileZipOutlined/>,
                disabled,
            },
            {
                key: 'font',
                title: '选择字体',
                icon: <FontSizeOutlined/>,
                disabled,
            }
        ];
        steps.push({
            key: 'execute',
            title: '执行',
            icon: <RocketOutlined/>,
            disabled,
        });
        return steps;
    }, [currentStep, execParam, executing]);

    const currentStepKey = steps[currentStep].key;

    const onNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else if (currentStepKey === 'execute') {
            if (executeRef.current) {
                executeRef.current.execute(execParam);
            }
        }
    }

    const [gamePlatform, setGamePlatform] = useState<string>();
    const [gameVersion, setGameVersion] = useState<number>();
    const [showLaunchButton, setExecutedSuccess] = useState(false);

    const setExecParamField = useCallback((key: string, value: any) => {
        setExecParam(prev => ({
            ...prev,
            [key]: value,
        }))
    }, []);

    const addExecParam = useCallback((params: any) => {
        setExecParam(prev => ({
            ...prev,
            ...params
        }));
    }, []);

    const launchGame = useCallback(() => {
        window.ipcRenderer.invoke('launch-game', { path: execParam.path }).then(() => {
            message.success('游戏已启动').then();
        }).catch((e: any) => {
            message.error('启动游戏失败: ' + e.message).then();
        });
    }, [execParam.path]);

    const onExecuted = useCallback((success: boolean) => {
        if (!success) return;
        // 腾讯平台不显示启动按钮
        if (gamePlatform === 'TENCENT') return;
        if (gamePlatform === 'GGG') {
            setExecutedSuccess(true);
            return;
        }
        // 未选择平台时，自动检测
        window.ipcRenderer.invoke('detect-game-platform', { path: execParam.path }).then((detectedPlatform: string) => {
            setGamePlatform(detectedPlatform);
            if (detectedPlatform === 'GGG') {
                setExecutedSuccess(true);
            }
        });
    }, [gamePlatform, execParam.path]);

    const getMainBtnText = () => {
        if (currentStepKey === 'execute') {
            return '执行';
        }
        if (currentStepKey === 'patch' && isEmpty(execParam.patch)) {
            return '跳过';
        }
        if (currentStepKey === 'font' && isEmpty(execParam.font) && !execParam.fontSizeDelta) {
            return '跳过';
        }
        return '下一步';
    }

    return (
        <div className='App'>
            <UpdateNotice />
            <div className="header">
                <Steps
                    current={currentStep}
                    onChange={(current) => {
                        setCurrentStep(current);
                        setExecutedSuccess(false);
                    }}
                    items={steps}
                    responsive={false}
                />
            </div>
            <div className="body">
                <GameInstallPath
                    visible={currentStepKey === 'path'}
                    onChange={(path, platform, version) => {
                        setExecParamField('path', path);
                        if (platform) {
                            setExecParamField('platform', platform);
                            setGamePlatform(platform);
                        }
                        if (version != null) {
                            setGameVersion(version);
                        }
                    }}
                />
                <PatchPath
                    visible={currentStepKey === 'patch'}
                    onChange={patch => setExecParamField('patch', patch)}
                />
                <SelectFont
                    patch={execParam.patch}
                    version={gameVersion}
                    visible={currentStepKey === 'font'}
                    onChange={params => addExecParam(params)}
                />
                <ExecuteActions ref={executeRef} visible={currentStepKey === "execute"} onExecutingChange={setExecuting} onExecuted={onExecuted} />
            </div>
            <div className="footer">
                <Button
                    disabled={executing || currentStep === 0}
                    onClick={() => {
                        setCurrentStep(prev => prev - 1);
                        setExecutedSuccess(false);
                    }}
                >
                    上一步
                </Button>
                {showLaunchButton && (
                    <Button type="primary" onClick={launchGame}>启动游戏</Button>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                    <Button
                        disabled={executing || isEmpty(execParam.path)}
                        onClick={() => {
                            if (gamePlatform === 'TENCENT') {
                                Modal.info({
                                    title: '修复客户端',
                                    content: '请使用 WeGame，点击游戏"启动"按钮旁边菜单中的"管理 - 修复游戏"功能进行修复。',
                                    okText: '知道了',
                                });
                            } else {
                                Modal.confirm({
                                    title: '修复客户端',
                                    content: '将运行 PackCheck.exe 检查并修复游戏文件，是否继续？',
                                    okText: '运行',
                                    cancelText: '取消',
                                    onOk: () => {
                                        window.ipcRenderer.invoke('run-pack-check', { path: execParam.path }).then(() => {
                                            message.success('PackCheck.exe 已启动').then();
                                        }).catch((e: any) => {
                                            message.error(e.message).then();
                                        });
                                    },
                                });
                            }
                        }}
                    >修复客户端</Button>
                    <Button
                        type="primary"
                        onClick={onNext}
                        disabled={currentStepKey === 'path' && isEmpty(execParam.path)}
                        loading={executing}
                    >
                        {getMainBtnText()}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default App