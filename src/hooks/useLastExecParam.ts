import { useLocalStorageState } from "ahooks";



export default function useLastExecParam() {
    return useLocalStorageState<ExecParam>('lastExecParam', {
        defaultValue: { path: '' },
        deserializer: JSON.parse,
        serializer: JSON.stringify,
    });
}