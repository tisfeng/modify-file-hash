/*
 * @author: tisfeng
 * @createTime: 2022-10-19 22:28
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-10-20 19:27
 * @fileName: utils.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Detail, getPreferenceValues, getSelectedFinderItems } from "@raycast/api";
import crypto from "crypto";
import { fileTypeFromFile } from "file-type";
import fs from "fs";
import path from "path";
import { useEffect, useState } from "react";
import readline from "readline";

export const appendString = "#1024";

interface MyPreferences {
  showLog: boolean;
}

export default function ModifyHash(modify: boolean) {
  console.log("run ModifyHash: ", modify);

  const [markdown, setMarkdown] = useState<string>();
  const title = modify ? "Modify Hash" : "Restore Hash";
  const showLog = getPreferenceValues<MyPreferences>().showLog;
  const noFileSelectedMsg = "⚠️ No file selected";

  // Todo: Add a progress bar
  // Todo: do not show error when no file selected
  const getSelectedFilePaths = async () => {
    console.log("getSelectedFilePaths");
    setMarkdown(`# ${title} \n\n ---- \n\n`);

    try {
      const selectedItems = await getSelectedFinderItems();
      if (selectedItems.length === 0) {
        setMarkdown((prev) => prev + noFileSelectedMsg);
        return;
      }
      return selectedItems;
    } catch (error) {
      console.error(`getSelectedFinderItems error: ${error}`);
      setMarkdown((prev) => prev + noFileSelectedMsg);
    }
  };

  /**
   * Apppend a string to the end of all files in the current directory.
   */
  async function appendStringToFileRecursive(path: string, str: string) {
    // if path has suffix /, remove it
    if (path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    const stat = fs.statSync(path);
    if (stat.isDirectory()) {
      if (showLog) {
        console.log(`Directory: ${path}`);
        const subtitle = `## Directory: ${path} \n\n`;
        setMarkdown((prev) => prev + subtitle);
      }

      const files = fs.readdirSync(path);
      files.forEach(async (file) => {
        const filePath = path + "/" + file;
        await appendStringToFileRecursive(filePath, str);
      });
    } else if (stat.isFile()) {
      await appendStringToFile(path, str);
    }
  }

  /**
   * Apppend a string to the end of file.
   */
  async function appendStringToFile(filePath: string, str: string) {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      console.log(`File: ${filePath}`);

      const isVideo = await isVideoFile(filePath);
      if (!isVideo) {
        console.log(`Not a video file: ${filePath}`);
        return;
      }

      if (showLog) {
        const oldMd5 = await md5File(filePath);
        const oldMd5Log = `\`${path.basename(filePath)}\` old md5: \`${oldMd5}\``;
        setMarkdown((prev) => prev + oldMd5Log + "\n\n");

        fs.appendFileSync(filePath, str);

        const newMd5 = await md5File(filePath);
        const newMd5Log = `\`${path.basename(filePath)}\` new md5: \`${newMd5}\``;
        setMarkdown((prev) => prev + newMd5Log + "\n\n");
      } else {
        fs.appendFileSync(filePath, str);
      }
    } else if (stat.isDirectory()) {
      await appendStringToFileRecursive(filePath, str);
    }
  }

  /**
   * Remove the appendString in the last line of all files in the current directory.
   */
  async function removeStringFromFileRecursive(path: string, str: string) {
    if (path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    const stat = fs.statSync(path);
    if (stat.isDirectory()) {
      if (showLog) {
        const subtitle = `## Directory: ${path} \n\n`;
        setMarkdown((prev) => prev + subtitle);
      }

      const files = fs.readdirSync(path);
      files.forEach(async (file) => {
        const filePath = path + "/" + file;
        await removeStringFromFileRecursive(filePath, str);
      });
    } else if (stat.isFile()) {
      await removeStringFromFile(path, str);
    }
  }

  async function removeStringFromFile(filePath: string, str: string) {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const isVideo = await isVideoFile(filePath);
      if (!isVideo) {
        console.log(`Not a video file: ${filePath}`);
        return;
      }

      console.log(`removeStringFromFile, File: ${filePath}`);

      // use stream to read line
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
      });

      const dir = path.dirname(filePath);
      const ext = path.extname(filePath);
      const filename = path.basename(filePath, ext);

      const tmpFile = `${dir}/${filename}_tmp${ext}`;
      console.log("tmpFile: ", tmpFile);
      const writable = fs.createWriteStream(tmpFile);

      rl.on("line", (line) => {
        if (line.endsWith(str)) {
          writable.write(line.replaceAll(str, ""));
        } else {
          writable.write(line);
        }
      });

      rl.on("close", async () => {
        console.warn("readline close");
        writable.close();

        const oldMd5 = await md5File(filePath);
        const oldMd5Log = `\`${path.basename(filePath)}\` old md5: \`${oldMd5}\``;
        setMarkdown((prev) => prev + oldMd5Log + "\n\n");
        const newMd5 = await md5File(tmpFile);
        const newMd5Log = `\`${path.basename(filePath)}\` new md5: \`${newMd5}\``;
        setMarkdown((prev) => prev + newMd5Log + "\n\n");

        fs.unlinkSync(filePath);
        fs.renameSync(tmpFile, filePath);
      });
    }
  }

  useEffect(() => {
    if (markdown === undefined) {
      getSelectedFilePaths().then((paths) => {
        if (paths) {
          paths.forEach(async (path) => {
            const filePath = path.path;
            console.log(`Path: ${filePath}`);

            if (modify) {
              appendStringToFileRecursive(filePath, appendString).then(() => {
                console.log("appendStringToFileRecursive done");

                const completeLog = `## ${title} has been completed 🎉🎉🎉 \n\n`;
                console.log(completeLog);
                setMarkdown((prev) => prev + completeLog);
              });
            } else {
              removeStringFromFileRecursive(filePath, appendString).then(() => {
                console.log("removeStringFromFileRecursive done");

                const completeLog = `## ${title} has been completed 🎉🎉🎉 \n\n`;
                console.log(completeLog);
                setMarkdown((prev) => prev + completeLog);
              });
            }
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

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
