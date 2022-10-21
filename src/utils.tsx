/*
 * @author: tisfeng
 * @createTime: 2022-10-19 22:28
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-10-21 23:20
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

export const APPEND_STRING = "#1024";

interface MyPreferences {
  showMD5Log: boolean;
}

export default function ModifyHash(isModify: boolean) {
  const [markdown, setMarkdown] = useState<string>();
  const title = isModify ? "Modify Video Hash" : "Restore Video Hash";
  const action = title.split(" ")[0].toLocaleLowerCase();
  const showMD5Log = getPreferenceValues<MyPreferences>().showMD5Log;
  const noFileSelectedMsg = "⚠️ No file selected";

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
   * Execute the command to a file path recursively.
   */
  async function exeCmdToFileRecursive(filePath: string, str: string, isModify: boolean): Promise<void> {
    // if path has suffix '/', remove it
    if (filePath.endsWith("/")) {
      filePath = filePath.slice(0, -1);
    }

    return new Promise((resolve) => {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        console.log(`Directory: ${filePath}`);

        const files = fs.readdirSync(filePath);
        const filePaths = files.map((file) => filePath + "/" + file);
        exeCmdToFileListRecursive(filePaths, str, isModify).then(() => {
          resolve();
        });
      } else if (stat.isFile()) {
        const exeCmd = isModify ? appendFileString : removeFileString;
        execCmdToFile(exeCmd, filePath, str).then(() => {
          console.log(`appendStringToFile done: ${filePath}`);
          resolve();
        });
      }
    });
  }

  /**
   * Execute command to a list of file paths recursively.
   */
  function exeCmdToFileListRecursive(filePaths: string[], str: string, isModify: boolean): Promise<void> {
    return new Promise((resolve) => {
      const exeCmdToFiles = filePaths.map((path) => {
        return exeCmdToFileRecursive(path, str, isModify);
      });
      Promise.all(exeCmdToFiles).then(() => {
        console.log(`filePaths exeCmdToFileListRecursive done: ${filePaths}`);
        resolve();
      });
    });
  }

  /**
   * Execute the command to the single file, not directory.
   */
  function execCmdToFile(
    exeCmd: (filePath: string, str: string) => Promise<void>,
    filePath: string,
    str: string
  ): Promise<void> {
    console.log(`execCmdToFile: ${filePath}`);

    return new Promise((resolve) => {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        console.warn(`Not a file: ${filePath}`);
        resolve();
      }

      isVideoFile(filePath).then((isVideo) => {
        if (!isVideo) {
          resolve();
        }

        let modifyFileLog = `${action}: \`${path.basename(filePath)}\` \n\n`;
        if (!showMD5Log) {
          setMarkdown((prev) => prev + modifyFileLog);
          console.log(modifyFileLog);

          exeCmd(filePath, str).then(() => {
            resolve();
          });
        } else {
          md5File(filePath).then((md5) => {
            modifyFileLog = `\`${path.basename(filePath)}\` old md5: \`${md5}\` \n\n`;
            setMarkdown((prev) => prev + modifyFileLog);
            console.log(modifyFileLog);

            exeCmd(filePath, str).then(() => {
              if (showMD5Log) {
                md5File(filePath).then((newMD5) => {
                  const newMD5Log = `\`${path.basename(filePath)}\` new md5: \`${newMD5}\` \n\n`;
                  console.log(newMD5Log);
                  setMarkdown((prev) => prev + newMD5Log + "\n\n");
                  resolve();
                });
              }
            });
          });
        }
      });
    });
  }

  function appendFileString(filePath: string, str: string): Promise<void> {
    fs.appendFileSync(filePath, str);
    return Promise.resolve();
  }

  async function removeFileString(filePath: string, str: string): Promise<void> {
    const cmd = `LC_CTYPE=C sed -i '' '$s/${str}//g' '${filePath}'`;
    return new Promise((resolve) => {
      execaCommand(cmd, { shell: true }).then(() => {
        console.log(`removeFileString done: ${filePath}`);
        resolve();
      });
    });
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
          exeCmdToFileListRecursive(filePaths, APPEND_STRING, isModify).then(() => {
            console.warn(`exeCmdToFileRecursive done: ${isModify}`);
            showCostTimeLog(startTime, toast);
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
 * Get the md5 hash of a file, use execa command.
 *
 * * Note: This function is fatser than md5File2.
 */
function md5File(filePath: string): Promise<string> {
  console.log(`md5 of file: ${path.basename(filePath)}`);

  const env = process.env;
  env.PATH = "/usr/sbin:/usr/bin:/bin:/sbin:/sbin/md5";

  return new Promise((resolve) => {
    const cmd = `md5 -q '${filePath}'`;
    execaCommand(cmd, { shell: true }).then((result) => {
      const md5 = result.stdout;
      console.log(`md5: ${md5}`);
      resolve(md5);

      delete env.PATH;
    });
  });
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
 * Use file-type to check if the file is a video file.
 */
async function isVideoFile(filePath: string): Promise<boolean> {
  const fileName = path.basename(filePath);
  console.log(`check isVideoFile: ${fileName}`);

  return new Promise((resolve) => {
    fileTypeFromFile(filePath).then((fileType) => {
      if (fileType) {
        // {ext: 'mp4', mime: 'video/mp4'}
        console.log(`File type: ${JSON.stringify(fileType)}`);
        const isVideo = fileType.mime.startsWith("video");
        console.log(`isVideo: ${isVideo}, ${fileName}`);
        resolve(isVideo);
      }
      resolve(isVideoFileBySuffix(filePath));
    });
  });
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
