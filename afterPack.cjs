const fs = require('fs');
const path = require('path');

exports.default = async function (context) {
  const appOutDir = context.appOutDir;

  // 删除不需要的语言包，只保留 zh-CN 和 en-US
  const localesDir = path.join(appOutDir, 'locales');
  if (fs.existsSync(localesDir)) {
    const keep = ['en-US.pak', 'zh-CN.pak'];
    fs.readdirSync(localesDir).forEach(file => {
      if (!keep.includes(file) && file.endsWith('.pak')) {
        fs.unlinkSync(path.join(localesDir, file));
      }
    });
  }

  // 删除 Chromium 许可证文件（终端用户不需要）
  const licenseFile = path.join(appOutDir, 'LICENSES.chromium.html');
  if (fs.existsSync(licenseFile)) {
    fs.unlinkSync(licenseFile);
  }
};
