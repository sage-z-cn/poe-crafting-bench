import React, { useCallback } from 'react';
import { Alert, Form, message, Radio, Slider, Tooltip } from "antd";
import classNames from "classnames";
import './index.css';
import ToggleableFeature from '@/components/HiddenFeatures/ToggleableFeature';
import AfterLightUp from '@/assets/after_light_up.png';
import BeforeLightUp from '@/assets/before_light_up.png';
import useLastExecParam from '@/hooks/useLastExecParam';

interface HiddenFeaturesProps {
    visible: boolean
    onChange: (params: Pick<ExecParam, 'removeFog' | 'minimapVisibility' | 'cameraZoom' | 'lightUp'>) => void
}

function HiddenFeatures(
    {
        visible,
        onChange,
    }: HiddenFeaturesProps
) {
    const [lastExecParam] = useLastExecParam();
    const [form] = Form.useForm();
    const cameraZoom = Form.useWatch('cameraZoom', form);
    const lightUp = Form.useWatch('lightUp', form);

    const onValuesChange = useCallback((changedValues: any, values: any) => {
        const {
            enableRemoveFog,
            removeFog,
            enableMinimapVisibility,
            minimapVisibility,
            enableCameraZoom,
            cameraZoom,
            enableLightUp,
            lightUp,
        } = values;
        onChange({
            removeFog: enableRemoveFog ? removeFog : undefined,
            minimapVisibility: enableMinimapVisibility ? minimapVisibility : undefined,
            cameraZoom: enableCameraZoom ? cameraZoom : undefined,
            lightUp: enableLightUp ? lightUp : undefined,
        })
    }, [onChange]);

    return (
        <div className={classNames('hidden-features', { 'hidden': !visible })}>
            <Alert
                className="hidden-features-hint"
                type="warning"
                message="更多功能为隐藏彩蛋，请勿公开传播"
            />
            <Alert
                className="hidden-features-hint"
                type="error"
                message="以下功能请谨慎开启，存在封号风险，后果自行承担！"
            />
            <Form
                form={form}
                initialValues={{
                    enableRemoveFog: false,
                    removeFog: true,
                    enableMinimapVisibility: false,
                    minimapVisibility: true,
                    enableCameraZoom: false,
                    cameraZoom: lastExecParam.cameraZoom || 1.5,
                    enableLightUp: false,
                    lightUp: lastExecParam.lightUp || 0.5,
                }}
                onValuesChange={onValuesChange}
            >
                <ToggleableFeature
                    label="小地图全开"
                    enableFieldName="enableMinimapVisibility"
                >
                    <Form.Item name="minimapVisibility" noStyle>
                        <Radio.Group>
                            <Radio value={true}>启用</Radio>
                            <Radio value={false}>禁用</Radio>
                        </Radio.Group>
                    </Form.Item>
                </ToggleableFeature>
                <ToggleableFeature
                    label="视距倍数"
                    enableFieldName="enableCameraZoom"
                >
                    <Form.Item name="cameraZoom" noStyle>
                        <Slider style={{ width: 480 }} min={1} max={3} step={0.1}
                                marks={{ 1: '还原', 1.5: '建议值 1.5' }}/>
                    </Form.Item>
                    <span>{cameraZoom}倍</span>
                </ToggleableFeature>
                <ToggleableFeature label="去除雾气" enableFieldName="enableRemoveFog">
                    <Form.Item name="removeFog" noStyle>
                        <Radio.Group>
                            <Radio value={true}>启用</Radio>
                            <Radio value={false}>禁用</Radio>
                        </Radio.Group>
                    </Form.Item>
                </ToggleableFeature>
                <ToggleableFeature label="点亮环境" enableFieldName="enableLightUp">
                    <Form.Item name="lightUp" noStyle>
                        <Slider style={{ width: 360 }} min={0} max={3} step={0.1}
                                marks={{ 0: '还原', 0.5: '建议值 0.5' }}/>
                    </Form.Item>
                    <span>{lightUp === 0 ? '还原' : `最小光亮 ${lightUp}`}</span>
                    <div className="light-up-example">
                        <Tooltip
                            getPopupContainer={triggerNode => triggerNode.parentElement || document.body}
                            trigger={['hover', 'click']}
                            title={(
                                <div className="light-up-example-imgs">
                                    <img src={BeforeLightUp}/>
                                    <img src={AfterLightUp}/>
                                </div>
                            )}
                        >
                            <span style={{ cursor: 'pointer', color: '#1677ff' }}>查看效果图</span>
                        </Tooltip>
                    </div>
                </ToggleableFeature>
            </Form>
        </div>
    );
}

export default HiddenFeatures;