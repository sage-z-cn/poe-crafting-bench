import { useCallback, useMemo, useRef, useState } from "react";
import { Button, Steps, message } from "antd";
import { FileZipOutlined, FolderOpenOutlined, FontSizeOutlined, RocketOutlined, SunOutlined } from "@ant-design/icons";
import { StepProps } from "antd/es/steps";
import { useLocalStorageState } from "ahooks";
import { isEmpty } from 'lodash';

import GameInstallPath from "@/components/GameInstallPath";
import PatchPath from "@/components/PatchPath";
import SelectFont from "@/components/SelectFont";
import HiddenFeatures from "@/components/HiddenFeatures";
import ExecuteActions, { ExecuteActionsHandler } from "@/components/ExecuteActions";
import UpdateNotice from "@/components/UpdateNotice";

import './App.css'

interface CustomStepProps extends StepProps {
    key: 'path' | 'patch' | 'font' | 'hiddenFeatures' | 'execute'
}

function App() {
    const SECRET_CLICK_TOTAL = 10
    const SECRET_CLICK_HINT = 5
    const executeRef = useRef<ExecuteActionsHandler>(null);
    const [execParam, setExecParam] = useState<ExecParam>({ path: '' });
    const [executing, setExecuting] = useState(false);
    const [currentStep, setCurrentStep] = useState<number>(0);
    const [secretClickTimes, setSecretClickTimes] = useState(0);
    const [showHiddenFeatures, setShowHiddenFeatures] = useLocalStorageState<boolean>('showHiddenFeatures', {
        defaultValue: false,
        serializer: value => value.toString(),
        deserializer: value => value === 'true',
    });
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
        if (showHiddenFeatures) {
            steps.push({
                key: 'hiddenFeatures',
                title: '更多功能',
                icon: <SunOutlined/>,
                disabled,
            });
        }
        steps.push({
            key: 'execute',
            title: '执行',
            icon: <RocketOutlined/>,
            disabled,
        });
        return steps;
    }, [showHiddenFeatures, currentStep, execParam, executing]);

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

    const onSecretClick = useCallback(() => {
        if (!showHiddenFeatures) {
            const times = secretClickTimes + 1;
            if (times < SECRET_CLICK_TOTAL) {
                setSecretClickTimes(times);
                if (times >= SECRET_CLICK_HINT) {
                    message.success({
                        key: 'secret-click-times',
                        content: `还差 ${SECRET_CLICK_TOTAL - times} 次开启更多功能！`
                    }).then();
                }
            } else {
                message.success({
                    key: 'secret-click-times',
                    content: '已开启更多功能！'
                }).then();
                setShowHiddenFeatures(true);
            }
        }
    }, [showHiddenFeatures, secretClickTimes]);

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
                    onChange={setCurrentStep}
                    items={steps}
                    responsive={false}
                />
            </div>
            <div className="body">
                <GameInstallPath
                    visible={currentStepKey === 'path'}
                    onChange={path => setExecParamField('path', path)}
                />
                <PatchPath
                    visible={currentStepKey === 'patch'}
                    onChange={patch => setExecParamField('patch', patch)}
                />
                <SelectFont
                    patch={execParam.patch}
                    visible={currentStepKey === 'font'}
                    onChange={params => addExecParam(params)}
                />
                <HiddenFeatures
                    visible={currentStepKey === 'hiddenFeatures'}
                    onChange={params => addExecParam(params)}
                />
                <ExecuteActions ref={executeRef} visible={currentStepKey === "execute"} onExecutingChange={setExecuting}/>
            </div>
            <div className="footer">
                <Button
                    // type={currentStep === 0 ? 'primary' : undefined}
                    disabled={executing || currentStep === 0}
                    onClick={() => setCurrentStep(prev => prev - 1)}
                >
                    上一步
                    {/*{ currentStep === 0 ? '修补' : '上一步' }*/}
                </Button>
                <div className="secret" onClick={onSecretClick}>你的血管里奔流着力量之河。</div>
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
    )
}

export default App