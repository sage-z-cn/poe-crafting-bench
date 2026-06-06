import React, { DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import classNames from "classnames";
import './index.css';
import { DeleteOutlined, HolderOutlined, InboxOutlined } from "@ant-design/icons";
import { isEmpty, uniq } from "lodash";
import {
    SortableContainer,
    SortableElement,
    SortableHandle,
    SortEnd,
} from "react-sortable-hoc";
import { arrayMoveMutable } from "array-move";
import { Button, Empty, message, Tooltip } from "antd";

interface PatchPathProps {
    visible: boolean
    onChange: (patchPaths: string[]) => void
}

interface SortableListProps {
    items: string[]
}

interface SortableItemProps {
    value: string
    index: number
}

function PatchPath(
    {
        visible,
        onChange,
    }: PatchPathProps
) {
    const [paths, setPaths] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false)
    const dragCounter = useRef<number>(0);
    const onChangeRef = useRef(onChange);
    const helperContainer = useRef<HTMLDivElement>(null);

    const onDropAreaClick = useCallback(() => {
        window.ipcRenderer.invoke('open-patch-file-dialog').then(paths => {
            if (!isEmpty(paths)) {
                setPaths(prev => {
                    const arr = uniq([...prev, ...paths]);
                    if (arr.length >= 8) {
                        arr.length = 8;
                        message.error('最多支持同时添加 8 个补丁').then();
                    }
                    return arr;
                });
            }
        });
    }, []);

    const onDragEnter = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;

        // 检查是否为文件拖拽
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    }, []);

    const onDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;

        // 当拖拽离开整个区域时取消激活状态
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    }, []);

    const onDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        if (!isDragging && e.dataTransfer.types.includes('Files')) {
            setIsDragging(true);
        }
    }, []);

    const onDrop = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;

        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles.length) {
            const filesArray = Array.from(droppedFiles);
            const paths = filesArray.map(file => window.ipcRenderer.getFilePath(file)).filter(path => path.toLowerCase().endsWith('.zip'));
            setPaths(prev => {
                const arr = uniq([...prev, ...paths]);
                if (arr.length >= 8) {
                    arr.length = 8;
                    message.error('最多支持同时添加 8 个补丁').then();
                }
                return arr;
            });
        }
    }, []);

    const onDelete = useCallback((value: string) => {
        setPaths(prev => prev.filter(path => path !== value));
    }, []);

    const DragHandler = SortableHandle(() => (
        <HolderOutlined/>
    ))

    const SortableItem = SortableElement<SortableItemProps>(({ value }: SortableItemProps) => (
        <Tooltip placement="left" title={value}>
            <div className="patch-list-item">
                <DragHandler/>
                <div className="patch-list-item-title">
                    {getFileName(value)}
                </div>
                <div className="patch-list-item-action">
                    <Button type="link" danger icon={<DeleteOutlined/>} onClick={(e) => onDelete(value)}/>
                </div>
            </div>
        </Tooltip>
    ));

    const SortableList = SortableContainer<SortableListProps>(({ items }: SortableListProps) => (
        <div className="patch-list" ref={helperContainer}>
            <div className="patch-list-title">待安装补丁</div>
            {
                items.map((item, index) => <SortableItem key={item} value={item} index={index}/>)
            }
            {
                items.length === 0 && (
                    <Empty className="mt-4" description="无数据"/>
                )
            }
        </div>
    ));

    const onSortEnd = useCallback(({ oldIndex, newIndex }: SortEnd) => {
        arrayMoveMutable(paths, oldIndex, newIndex)
    }, [paths]);

    useEffect(() => {
        onChangeRef.current(paths || []);
    }, [paths]);

    return (
        <div className={classNames('patch-path', { 'hidden': !visible })}>
            <div
                className={classNames('patch-drop-area', { 'patch-drop-area--highlight': isDragging })}
                onClick={onDropAreaClick}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
            >
                <div className="patch-drop-area-icon">
                    <InboxOutlined/>
                </div>
                <div className="patch-drop-area-text">
                    点击 或 拖放压缩包到 此区域来添加补丁
                </div>
                <div className="patch-drop-area-hint">
                    <p>支持一个或多个补丁安装</p>
                    <p>同时安装多个补丁请在右侧调整顺序，功能补丁放第一位</p>
                    <p>本工具不提供补丁，请前往下载<a onClick={(e) => { e.stopPropagation(); window.ipcRenderer.invoke('open-external', 'https://www.caimogu.cc/user/35425.html'); }}>【A大】</a>的补丁进行安装</p>
                </div>
            </div>
            <SortableList
                items={paths}
                helperClass="dragging"
                axis="y"
                onSortEnd={onSortEnd}
                useDragHandle
                helperContainer={() => helperContainer.current || document.body}
            />
        </div>
    );
}

function getFileName(filePath: string) {
    return filePath.split('\\').pop();
}

export default PatchPath;