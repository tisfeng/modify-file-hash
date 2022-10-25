/*
 * @author: tisfeng
 * @createTime: 2022-10-19 22:28
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-10-25 22:59
 * @fileName: utils.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Detail, getPreferenceValues, getSelectedFinderItems, showToast, Toast } from "@raycast/api";
import crypto from "crypto";
import { execaCommand, ExecaReturnValue } from "execa";
import { fileTypeFromFile } from "file-type";
import fs from "fs";
import path from "path";
import { useEffect, useState } from "react";

export const APPEND_STRING = "#$1024$#";

export enum ActionType {
  ModifyHash = "Modify Hash",
  RestoreHash = "Restore Hash",
  ZipCompress = "ZipCompress",
  ZipDecompress = "ZipDecompress",
}

interface MyPreferences {
  showMD5Log: boolean;
  enableVideo: boolean;
  enableAudio: boolean;
  enableImage: boolean;
  zipCompressPassword: string;
}

export interface MediaFileInfo {
  ext: string;
  mime: string;
  mediaType?: MediaType;
}

enum MediaType {
  Video = "Video",
  Audio = "Audio",
  Image = "Image",
}

export default function RunCommand(actionType: ActionType) {
  const [markdown, setMarkdown] = useState<string>();

  let title = "";
  let action = "";
  let isHashAction = false;
  switch (actionType) {
    case ActionType.ModifyHash:
      title = "Modify File Hash";
      action = "Modify";
      isHashAction = true;
      break;
    case ActionType.RestoreHash:
      title = "Restore File Hash";
      action = "Restore";
      isHashAction = true;
      break;
    case ActionType.ZipCompress:
      title = "Zip Compress";
      action = title;
      isHashAction = false;
      break;
    case ActionType.ZipDecompress:
      title = "Zip Decompress";
      action = title;
      isHashAction = false;
      break;
  }

  const myPreferences = getPreferenceValues<MyPreferences>();
  const { showMD5Log, zipCompressPassword, enableVideo, enableAudio, enableImage } = myPreferences;
  const password = zipCompressPassword.trim();
  const enableTypes: MediaType[] = [];
  if (enableVideo) {
    enableTypes.push(MediaType.Video);
  }
  if (enableAudio) {
    enableTypes.push(MediaType.Audio);
  }
  if (enableImage) {
    enableTypes.push(MediaType.Image);
  }

  const getSelectedFilePaths = async () => {
    console.log("getSelectedFilePaths");
    console.log(`enableTypes: ${enableTypes}`);

    setMarkdown(`# ${title} \n\n ---- \n\n`);

    if (isHashAction && enableTypes.length === 0) {
      const noEanbledTypeMsg = "⚠️ No media type enabled, please select at least one media type in preferences.";
      setMarkdown((prev) => prev + noEanbledTypeMsg);
      return;
    }

    let noFileSelectedMsg = "⚠️ No file selected, please select at least one file.";
    if (isHashAction) {
      noFileSelectedMsg = "⚠️ No file selected, please select files containing media.";
    }

    try {
      const selectedItems = await getSelectedFinderItems();
      if (selectedItems.length === 0) {
        setMarkdown((prev) => prev + noFileSelectedMsg);
        return;
      }
      return selectedItems;
    } catch (error) {
      console.warn(`getSelectedFinderItems error: ${error}`);
      setMarkdown((prev) => prev + noFileSelectedMsg);
    }
  };

  /**
   * Execute command to a list of file paths recursively.
   */
  async function exeCmdToFileListRecursive(filePaths: string[], str: string, isModify: boolean): Promise<void> {
    const exeCmdToFiles = filePaths.map((path) => exeCmdToFileRecursive(path, str, isModify));
    await Promise.all(exeCmdToFiles);
  }

  /**
   * Execute the command to a file path recursively.
   */
  async function exeCmdToFileRecursive(filePath: string, str: string, isModify: boolean): Promise<void> {
    // if path has suffix '/', remove it
    if (filePath.endsWith("/")) {
      filePath = filePath.slice(0, -1);
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      console.log(`Directory: ${filePath}`);

      const files = fs.readdirSync(filePath);
      const filePaths = files.map((file) => filePath + "/" + file);
      await exeCmdToFileListRecursive(filePaths, str, isModify);
    } else if (stat.isFile()) {
      const exeCmd = isModify ? appendStringToFile : removeStringFromFile;
      await execCmdToFile(exeCmd, filePath, str);
    }
  }

  /**
   * Execute the command to the single file, not directory.
   */
  async function execCmdToFile(
    exeCmd: (filePath: string, str: string) => Promise<void>,
    filePath: string,
    str: string
  ): Promise<void> {
    console.log(`execCmdToFile: ${filePath}`);
    const fileName = path.basename(filePath);

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      console.warn(`Not a file: ${fileName}`);
      return;
    }

    const mediaFileInfo = await getMediaFileInfo(filePath);
    if (!mediaFileInfo?.mediaType) {
      console.warn(`Not a media file: ${fileName}`);
      return;
    }

    if (!enableTypes.includes(mediaFileInfo.mediaType)) {
      console.warn(`Not a enabled media type: ${fileName}`);
      return;
    }

    if (!showMD5Log) {
      const modifyFileLog = `- \`${fileName}\` \n\n`;
      setMarkdown((prev) => prev + modifyFileLog);
      console.log(modifyFileLog);
      await exeCmd(filePath, str);
    } else {
      const md5 = await md5File(filePath);
      const oldMD5Log = `- \`${fileName}\` old md5: \`${md5}\` \n\n`;
      setMarkdown((prev) => prev + oldMD5Log);
      console.log(oldMD5Log);
      await exeCmd(filePath, str);
      const newMD5 = await md5File(filePath);
      const newMD5Log = `- \`${fileName}\` new md5: \`${newMD5}\` \n\n`;
      console.log(newMD5Log);
      setMarkdown((prev) => prev + newMD5Log + "\n\n");
    }
  }

  function showCostTimeLog(startTime: number, toast: Toast) {
    const costTimeLog = `### Cost time: \`${(new Date().getTime() - startTime) / 1000}\` seconds`;
    console.log(costTimeLog);
    setMarkdown((prev) => prev + costTimeLog + "\n\n");

    const successLog = `${title} Completed!`;
    const completeLog = `## ${successLog} 🎉🎉🎉 \n\n`;
    console.log(completeLog);
    setMarkdown((prev) => prev + completeLog);

    toast.style = Toast.Style.Success;
    toast.title = successLog;
  }

  useEffect(() => {
    if (markdown === undefined) {
      getSelectedFilePaths().then(async (paths) => {
        if (paths) {
          const toast = await showToast({
            style: Toast.Style.Animated,
            title: `Start ${title} ......`,
          });

          const startTime = new Date().getTime();
          const filePaths = paths.map((item) => item.path);

          if (actionType === ActionType.ModifyHash || actionType === ActionType.RestoreHash) {
            const modifyHashTitle = `### Start ${action} ——> Enabled File Types: \`${enableTypes}\` \n\n`;
            setMarkdown((prev) => prev + modifyHashTitle);

            const isModify = actionType === ActionType.ModifyHash;
            await exeCmdToFileListRecursive(filePaths, APPEND_STRING, isModify);
            console.warn(`exeCmdToFileRecursive done: ${isModify}`);
          } else {
            let zipCompressTitle = `### Start ${action}`;
            if (password) {
              zipCompressTitle += ` ——> Password: \`${password}\` \n\n`;
            }
            setMarkdown((prev) => prev + zipCompressTitle);

            if (actionType === ActionType.ZipCompress) {
              await zipCompressFiles(filePaths);
            } else {
              await zipDecompressFiles(filePaths);
            }
          }
          showCostTimeLog(startTime, toast);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

  /**
   * Get zip compress file path.
   *
   * If filePaths has only one file, return the file path + '.zip'.
   * If filePaths has only one directory, return the directory path + '.zip'.
   * If filePaths has more than one file or directory, return the first file path + files count + '.zip'.
   */
  function getZipCompressFilePath(filePaths: string[]): string | undefined {
    let firstFilePath = filePaths[0];
    if (!firstFilePath) {
      console.warn("No file selected");
      return;
    }

    if (filePaths.length === 1) {
      const stat = fs.statSync(firstFilePath);
      if (stat.isFile()) {
        return firstFilePath + ".zip";
      } else if (stat.isDirectory()) {
        if (firstFilePath.endsWith("/")) {
          firstFilePath = firstFilePath.slice(0, -1);
        }
        return firstFilePath + ".zip";
      }
    } else {
      const dir = path.dirname(firstFilePath);
      const fileName = path.parse(firstFilePath).name;
      return path.join(dir, fileName + ` (${filePaths.length} files)` + ".zip");
    }
  }

  /**
   * Zip compress or decompress selected files.
   */
  async function zipCompressFiles(filePaths: string[]): Promise<void> {
    const selectedFileNames = filePaths.map((filePath) => path.basename(filePath));
    const markdown = selectedFileNames.map((fileName) => `- \`${fileName}\` \n\n`).join("");
    setMarkdown((prev) => prev + markdown);

    const zipFilePath = getZipCompressFilePath(filePaths);
    console.log(`zipFilePath: ${zipFilePath}`);
    if (zipFilePath) {
      const dir = path.dirname(zipFilePath);
      const zipFileName = path.basename(zipFilePath);
      let cmd = "zip -r ";
      if (password.length > 0) {
        cmd += `-P '${password}' `;
      }
      cmd += `'${zipFileName}'  '${selectedFileNames.join("' '")}'`;
      console.log(`zip cmd: ${cmd}`);
      await execaCommand(cmd, { shell: true, cwd: dir });

      const zipCompressLog = `### Zip Compressed to File: \`${zipFileName}\` \n\n`;
      setMarkdown((prev) => prev + zipCompressLog);
      console.log(zipCompressLog);
    }
  }

  /**
   * Decompress zip file.
   */
  async function zipDecompressFiles(filePaths: string[]): Promise<void> {
    const zipFilePaths = filePaths.filter((filePath) => isZipFile(filePath));
    if (zipFilePaths.length === 0) {
      const noZipFileLog = "⚠️ No zip file selected. \n\n";
      console.warn(noZipFileLog);
      setMarkdown((prev) => prev + noZipFileLog);
      return;
    }

    const zipFilePath = getZipCompressFilePath(zipFilePaths);
    if (zipFilePath) {
      console.log(`zipFilePath: ${zipFilePath}`);
      const dir = path.dirname(zipFilePath);
      const fileName = path.basename(zipFilePath);

      // yyk.mp4.zip.zip  =>  yyk
      const fileNameWithoutExt = fileName.slice(0, fileName.indexOf("."));
      const zipDecompressFilePath = path.join(dir, fileNameWithoutExt);
      const zipUniqueFilePath = getUniqueFilePath(zipDecompressFilePath);
      console.log(`zipUniqueFilePath: ${zipUniqueFilePath}`);

      await zipDecompressFilesToPath(zipFilePaths, zipUniqueFilePath);
    }
  }

  /**
   * Decompress zip files to file path.
   */
  async function zipDecompressFilesToPath(zipFilePaths: string[], targetPath: string): Promise<void> {
    fs.mkdirSync(targetPath);

    const selectedFileNames = zipFilePaths.map((filePath) => path.basename(filePath));
    const markdown = selectedFileNames.map((fileName) => `- \`${fileName}\` \n\n`).join("");
    setMarkdown((prev) => prev + markdown);

    const dir = path.dirname(targetPath);
    const decompressedFileName = path.basename(targetPath);
    const decompressFileNames = zipFilePaths.map((filePath) => path.basename(filePath, ".zip"));
    const decompressFileCommands = decompressFileNames.map((fileName) => {
      let cmd = `unzip -d '${decompressedFileName}' `;
      if (password.length > 0) {
        cmd += `-P '${password}' `;
      }
      cmd += `'${fileName}' `;
      console.log(`unzip cmd: ${cmd}`);
      return execaCommand(cmd, { shell: true, cwd: dir });
    });

    try {
      await Promise.all(decompressFileCommands);
      const decompressLog = `### Decompressed to File: \`${decompressedFileName}\` \n\n`;
      setMarkdown((prev) => prev + decompressLog);
      console.log(decompressLog);
    } catch (error) {
      fs.rmdirSync(targetPath);

      const err = error as ExecaReturnValue;
      console.error(`ZipDecompress error: ${JSON.stringify(err, null, 4)}`);
      let errorLog = `### ⚠️ Error \n\n `;
      errorLog += `\`\`\` \n\n`;
      errorLog += `${err.stderr} \n\n`;
      errorLog += `\`\`\` \n\n`;
      setMarkdown((prev) => prev + errorLog);
    }
  }

  /**
   * Get a unique file name, if the file path already exists, add a number suffix.
   */
  function getUniqueFilePath(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      return filePath;
    }

    const dir = path.dirname(filePath);
    const fileName = path.parse(filePath).name;
    const ext = path.extname(filePath);

    let i = 2;
    while (fs.existsSync(filePath)) {
      filePath = path.join(dir, fileName + ` ${i}` + ext);
      i++;
    }
    return filePath;
  }

  /**
   * Check if the file is a zip file.
   */
  function isZipFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    return ext === ".zip" || ext === ".ZIP";
  }

  return <Detail markdown={markdown} />;
}

function appendStringToFile(filePath: string, str: string): Promise<void> {
  fs.appendFileSync(filePath, str);
  return Promise.resolve();
}

async function removeStringFromFile(filePath: string, str: string): Promise<void> {
  // -i means in-place, $ means end of line.
  const cmd = `LC_CTYPE=C sed -i '' '$s/${str}//g' '${filePath}'`;
  await execaCommand(cmd, { shell: true });
  console.log(`removeFileString done: ${filePath}`);
}

/**
 * Get the md5 hash of a file, use execa command.
 *
 * * Note: This function is fatser than md5File2.
 */
async function md5File(filePath: string): Promise<string> {
  console.log(`md5 of file: ${path.basename(filePath)}`);

  const env = process.env;
  env.PATH = "/usr/sbin:/usr/bin:/bin:/sbin:/sbin/md5";

  const cmd = `md5 -q '${filePath}'`;
  const result = await execaCommand(cmd, { shell: true });
  const md5 = result.stdout;
  console.log(`md5: ${md5}`);
  delete env.PATH;

  return md5;
}

/**
 * Get the md5 hash of a file, use stream.
 */
export function md5File2(filePath: string): Promise<string> {
  console.log(`md5 of file: ${path.basename(filePath)}`);

  return new Promise((resolve) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => {
      const md5 = hash.digest("hex");
      console.log(`md5: ${md5}`);
      resolve(md5);
    });
  });
}

/**
 * Get media file info from file, use file-type.
 */
async function getMediaFileInfo(filePath: string): Promise<MediaFileInfo | undefined> {
  const fileName = path.basename(filePath);
  console.log(`get media file info: ${fileName}`);

  const fileType = await fileTypeFromFile(filePath); // {ext: 'mp4', mime: 'video/mp4'}
  if (fileType) {
    console.log(`File type: ${JSON.stringify(fileType)}`);
    const type = fileType.mime.split("/")[0];
    const mediaFileInfo: MediaFileInfo = {
      ext: fileType.ext,
      mime: fileType.mime,
    };

    const allMediaTypes = Object.values(MediaType).map((item) => item.toLowerCase());
    if (allMediaTypes.includes(type)) {
      mediaFileInfo.mediaType = capitalizeFirstLetter(type) as MediaType;
      console.log(`mediaFileInfo: ${JSON.stringify(mediaFileInfo, null, 4)}`);
    }
    return mediaFileInfo;
  }
}

/**
 * Capitalize the first letter of a string.
 */
function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
