import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDebounceFn, useMount } from "ahooks";
import { isEmpty } from "lodash";
import classNames from "classnames";
import { Button, Input, InputNumber, Popover, Radio, Space } from "antd";
import './index.css';
import useLastExecParam from "@/hooks/useLastExecParam";

interface SelectFontProps {
  visible: boolean
  onChange: (params: Pick<ExecParam, 'font' | 'fontSizeDelta'>) => void
  patch?: ExecParam['patch'];
}

function SelectFont(
  {
    visible,
    onChange,
    patch,
  }: SelectFontProps
) {
  const [lastExecParam] = useLastExecParam();
  const onChangeRef = useRef(onChange);
  const fontListRef = useRef<HTMLDivElement>(null);
  const [keyword, setKeyword] = useState<string>();
  const [fonts, setFonts] = useState<string[]>([]);
  const [font, setFont] = useState<string>('');
  const [fontSizeDelta, setFontSizeDelta] = useState<number>(0);

  useMount(() => {
    getInstalledFonts();

    if (lastExecParam.font) {
      setFont(lastExecParam.font);
      onChangeRef.current({
        font: lastExecParam.font,
        fontSizeDelta,
      });
    }
  });

  const f2sPatch = useMemo(() => {
    if (patch) {
      return patch.some(p => p.includes('繁转简'));
    }
    return false;
  }, [patch])

  // 检测到繁转简补丁时，清除已选字体
  useEffect(() => {
    if (f2sPatch && font) {
      setFont('');
      onChange({ font: '', fontSizeDelta });
    }
  }, [f2sPatch])

  const getInstalledFonts = useCallback(() => {
    window.ipcRenderer.invoke('get-installed-fonts').then((res: string[]) => {
      if (!isEmpty(res)) {
        res.sort((a, b) => {
          const isChineseA = /^[\u4E00-\u9FFF]/.test(a);
          const isChineseB = /^[\u4E00-\u9FFF]/.test(b);
          if (isChineseA && isChineseB) {
            return a.localeCompare(b, 'zh');
          }
          if (!isChineseA && !isChineseB) {
            return a.localeCompare(b, 'en', { sensitivity: 'base' });
          }
          return isChineseA ? -1 : 1;
        });
        setFonts(res);
      }
    });
  }, []);

  // 字体列表加载完成后或组件变为可见时，滚动到当前选中的字体项
  // useLayoutEffect 在 DOM 更新后浏览器绘制前同步执行，确保滚动不闪烁
  // 依赖 visible：挂载时组件可能隐藏（如步骤0），scrollIntoView 在隐藏元素上不生效，
  //              等切换到字体步骤时 visible 变为 true 再触发滚动
  useLayoutEffect(() => {
    if (visible && fonts.length > 0 && font && fontListRef.current) {
      const idx = fonts.indexOf(font);
      if (idx >= 0) {
        // 通过 class 查找，不依赖 id（antd Radio 可能不传递 id 到 DOM）
        const items = fontListRef.current.querySelectorAll<HTMLElement>('.font-list-item');
        // +1 跳过第一项"不修改字体"
        items[idx + 1]?.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [visible, fonts, font]);

  useEffect(() => {
    if (onChangeRef.current) {
      onChangeRef.current({ font, fontSizeDelta });
    }
  }, [font, fontSizeDelta])

  const openDotNet8 = useCallback(() => {
    window.ipcRenderer.invoke('open-external', 'https://aka.ms/dotnet-core-applaunch?framework=Microsoft.NETCore.App&framework_version=8.0.0&arch=x64&rid=win10-x64');
  }, []);

  return (
    <div className={classNames('select-font', { 'hidden': !visible })}>
      <div className="font-list-container">
        <Space>
          <Input
            placeholder="输入字体名称搜索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
          />
          <Button type="primary" onClick={() => getInstalledFonts()}>刷新列表</Button>
        </Space>
        <div className="font-list" ref={fontListRef}>
          <Radio.Group disabled={f2sPatch} value={f2sPatch ? '' : font} onChange={e => setFont(e.target.value)}>
            <Space direction="vertical">
              <Radio className="font-list-item" value="">
                不修改字体
              </Radio>
              {
                fonts.filter(f => !keyword || f.includes(keyword)).map((font, index) => (
                  <Radio
                    key={font}
                    className="font-list-item"
                    id={`font-list-item_${index}`}
                    style={{ fontFamily: font }}
                    value={font}
                  >
                    {font}
                  </Radio>
                ))
              }
            </Space>
          </Radio.Group>
        </div>
        <Space>
          <span>字体大小调整：</span>
          <InputNumber
            value={fontSizeDelta}
            min={-10}
            max={10}
            onChange={(value) => setFontSizeDelta(value || 0)}
          />
          <Popover
            content={
              <div>
                <p>1. 可选字体为电脑已安装的字体，安装新字体后需要刷新列表才会显示</p>
                <p>2. 字体大小调整会在游戏原有字体大小基础上加上或减去此数值，<br/>而非直接设置成此数值</p>
                <p>3. 繁转简补丁不可以修改字体</p>
              </div>
            }
            trigger="hover"
            placement="top"
          >
            <Button type="link">说明</Button>
          </Popover>
        </Space>
      </div>
      <div className="font-preview-container">
        {isEmpty(font) ? (
          <div className="font-preview-hint">
            {f2sPatch ? (
                <p>
                  <p style={{ color: '#DC2626' }}>补丁列表中存在繁转简补丁，不可以修改字体</p>
                  <p>繁转简补丁的原理就是通过修改字体实现，和改字体功能冲突，若要改字体请换简体或繁体补丁</p>
                </p>
              ) :
              <p>左侧字体列表中选择字体后在此进行预览</p>}
          </div>
        ) : (
          <div className="unique-item" style={font ? { fontFamily: font } : {}}>
            <div className="unique-item-header">
              <div className="item-name">法师之血(仅做演示，同时支持POE1/2)</div>
              <div className="item-name">重革腰带</div>
            </div>
            <div className="unique-item-content">
              <div>腰带</div>
              <div className="unique-item-content-seperator"/>
              <div>需求 等级 <span className="color-white">44</span></div>
              <div className="unique-item-content-seperator"/>
              <div><span className="color-white">+35</span> 力量</div>
              <div className="unique-item-content-seperator"/>
              <div><span className="color-white">+50</span> 敏捷</div>
              <div><span className="color-white">+25</span><span className="color-magic">% 火焰抗性</span>
              </div>
              <div><span className="color-white">+25</span><span className="color-magic">% 冰霜抗性</span>
              </div>
              <div><span className="color-magic">不能使用魔法非恢复类药剂</span></div>
              <div><span className="color-magic">最左边的 <span className="color-white">4</span> 个魔法非恢复类药剂给你持续提供药剂效果</span>
              </div>
              <div><span className="color-magic">不能移除魔法非恢复类药剂效果</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SelectFont;