/*
 * @author: tisfeng
 * @createTime: 2022-10-19 22:28
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-10-20 23:54
 * @fileName: utils.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Detail, getPreferenceValues, getSelectedFinderItems, showToast, Toast } from "@raycast/api";
import crypto from "crypto";
import { execaCommand } from "execa";
import { fileTypeFromFile } from "file-type";
import fs from "fs";
import path from "path";
import { useEffect, useState } from "react";

export const appendString = "#1024";

interface MyPreferences {
  showMd5Log: boolean;
}

export default function ModifyHash(modify: boolean) {
  console.log("run ModifyHash: ", modify);

  const [markdown, setMarkdown] = useState<string>();
  const title = modify ? "Modify Hash" : "Restore Hash";
  const action = title.split(" ")[0].toLocaleLowerCase();
  const showMd5Log = getPreferenceValues<MyPreferences>().showMd5Log;
  const noFileSelectedMsg = "⚠️ No file selected";

  // Todo: Add a progress bar
  const getSelectedFilePaths = async () => {
    console.log("getSelectedFilePaths");
    setMarkdown(`# ${title} \n\n ---- \n\n`);

    try {
      const selectedItems = await getSelectedFinderItems();
      if (selectedItems.length === 0) {
        setMarkdown((prev) => prev + noFileSelectedMsg);
        return;
      }
      setMarkdown((prev) => prev + `### start \`${title}\` \n\n`);
      return selectedItems;
    } catch (error) {
      console.warn(`getSelectedFinderItems error: ${error}`);
      setMarkdown((prev) => prev + noFileSelectedMsg);
    }
  };

  /**
   * Apppend a string to the end of all files in the current directory.
   */
  function appendStringToFileRecursive(path: string, str: string): Promise<void> {
    // if path has suffix /, remove it
    if (path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    return new Promise((resolve) => {
      const stat = fs.statSync(path);
      if (stat.isDirectory()) {
        console.log(`Directory: ${path}`);

        const files = fs.readdirSync(path);
        files.forEach((file) => {
          const filePath = path + "/" + file;
          resolve(appendStringToFileRecursive(filePath, str));
        });
      } else if (stat.isFile()) {
        resolve(appendStringToFile(path, str));
      }
    });
  }

  /**
   * Apppend a string to the end of file.
   */
  async function appendStringToFile(filePath: string, str: string): Promise<void> {
    console.log(`appendStringToFile: ${filePath}`);

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      console.warn(`Not a file: ${filePath}`);
      return;
    }

    console.log(`File: ${filePath}`);

    const isVideo = await isVideoFile(filePath);
    if (!isVideo) {
      console.log(`Not a video file: ${filePath}`);
      return;
    }

    if (showMd5Log) {
      const oldMd5 = await md5File(filePath);
      const oldMd5Log = `\`${path.basename(filePath)}\` old md5: \`${oldMd5}\``;
      setMarkdown((prev) => prev + oldMd5Log + "\n\n");
    } else {
      const fileLog = `${action}: \`${path.basename(filePath)}\``;
      setMarkdown((prev) => prev + fileLog + "\n\n");
    }

    fs.appendFileSync(filePath, str);

    if (showMd5Log) {
      const newMd5 = await md5File(filePath);
      const newMd5Log = `\`${path.basename(filePath)}\` new md5: \`${newMd5}\``;
      setMarkdown((prev) => prev + newMd5Log + "\n\n");
    }

    return Promise.resolve();
  }

  /**
   * Remove the appendString in the last line of all files in the current directory.
   */
  async function removeStringFromFileRecursive(path: string, str: string): Promise<void> {
    if (path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    return new Promise((resolve) => {
      const stat = fs.statSync(path);
      if (stat.isDirectory()) {
        console.log(`Directory: ${path}`);

        const files = fs.readdirSync(path);
        files.forEach(async (file) => {
          const filePath = path + "/" + file;
          resolve(removeStringFromFileRecursive(filePath, str));
        });
      } else if (stat.isFile()) {
        resolve(removeStringFromFile(path, str));
      }
    });
  }

  async function removeStringFromFile(filePath: string, str: string): Promise<void> {
    console.log(`removeStringFromFile: ${filePath}`);

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      console.warn(`Not a file: ${filePath}`);
      return;
    }

    console.log(`File: ${filePath}`);

    const isVideo = await isVideoFile(filePath);
    if (!isVideo) {
      console.log(`Not a video file: ${filePath}`);
      return;
    }

    if (showMd5Log) {
      const oldMd5 = await md5File(filePath);
      const oldMd5Log = `\`${path.basename(filePath)}\` old md5: \`${oldMd5}\``;
      setMarkdown((prev) => prev + oldMd5Log + "\n\n");
    } else {
      const fileLog = `${action}: \`${path.basename(filePath)}\``;
      setMarkdown((prev) => prev + fileLog + "\n\n");
    }

    const cmd = `LC_CTYPE=C sed -i '' '$s/${str}//g' '${filePath}'`;
    await execaCommand(cmd, { shell: true });

    if (showMd5Log) {
      const newMd5 = await md5File(filePath);
      const newMd5Log = `\`${path.basename(filePath)}\` new md5: \`${newMd5}\``;
      setMarkdown((prev) => prev + newMd5Log + "\n\n");
    }

    return Promise.resolve();
  }

  useEffect(() => {
    if (markdown === undefined) {
      getSelectedFilePaths().then(async (paths) => {
        if (paths) {
          const toast = await showToast({
            style: Toast.Style.Animated,
            title: `Start ${title} ......`,
          });

          paths.forEach(async (path) => {
            const filePath = path.path;
            console.log(`Path: ${filePath}`);

            const startTime = new Date().getTime();
            if (modify) {
              appendStringToFileRecursive(filePath, appendString).then(() => {
                console.log("appendStringToFileRecursive done");
                showCostTimeLog(startTime, toast);
              });
            } else {
              removeStringFromFileRecursive(filePath, appendString).then(() => {
                console.log("removeStringFromFileRecursive done");
                showCostTimeLog(startTime, toast);
              });
            }
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

  function showCostTimeLog(startTime: number, toast: Toast) {
    const costTimeLog = `### cost time: \`${(new Date().getTime() - startTime) / 1000}\` seconds`;
    console.log(costTimeLog);
    setMarkdown((prev) => prev + costTimeLog + "\n\n");

    const successLog = `${title} Successfully`;
    const completeLog = `## ${successLog} 🎉🎉🎉 \n\n`;
    console.log(completeLog);
    setMarkdown((prev) => prev + completeLog);

    toast.style = Toast.Style.Success;
    toast.title = successLog;
  }

  return <Detail markdown={markdown} />;
}

/**
 * Get the md5 hash of a file, use stream.
 */
function md5File(filePath: string): Promise<string> {
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
 * Use file-type to check if the file is a video file.
 */
async function isVideoFile(filePath: string): Promise<boolean> {
  const fileType = await fileTypeFromFile(filePath);
  if (fileType) {
    console.log(`File type: ${JSON.stringify(fileType)}`);
    // {ext: 'mp4', mime: 'video/mp4'}
    return fileType.mime.startsWith("video");
  }
  return isVideoFileBySuffix(filePath);
}

/**
 * Check if the file has a video suffix.
 */
function isVideoFileBySuffix(filePath: string): boolean {
  const videoSuffixes = [
    "mp4",
    "mov",
    "avi",
    "flv",
    "wmv",
    "mkv",
    "rmvb",
    "rm",
    "3gp",
    "quicktime",
    "mts",
    "m2ts",
    "vob",
  ];
  const suffix = path.extname(filePath);
  return videoSuffixes.includes(suffix);
}
