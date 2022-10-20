/*
 * @author: tisfeng
 * @createTime: 2022-10-19 22:28
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-10-20 10:17
 * @fileName: utils.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Detail, getPreferenceValues, getSelectedFinderItems } from "@raycast/api";
import CryptoJS from "crypto-js";
import fs from "fs";
import path from "path";
import { useEffect, useState } from "react";

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
  function appendStringToFileRecursive(path: string, str: string) {
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
      files.forEach((file) => {
        const filePath = path + "/" + file;
        appendStringToFileRecursive(filePath, str);
      });
    } else if (stat.isFile()) {
      appendStringToFile(path, str);
    }
  }

  /**
   * Apppend a string to the end of file.
   */
  function appendStringToFile(filePath: string, str: string) {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      console.log(`File: ${filePath}`);
      if (showLog) {
        const oldMd5 = md5File(filePath);
        const oldMd5Log = `\`${path.basename(filePath)}\` old md5: \`${oldMd5}\``;
        setMarkdown((prev) => prev + oldMd5Log + "\n\n");

        fs.appendFileSync(filePath, str);

        const newMd5 = md5File(filePath);
        const newMd5Log = `\`${path.basename(filePath)}\` new md5: \`${newMd5}\``;
        setMarkdown((prev) => prev + newMd5Log + "\n\n");
      } else {
        fs.appendFileSync(filePath, str);
      }
    } else if (stat.isDirectory()) {
      appendStringToFileRecursive(filePath, str);
    }
  }

  /**
   * Remove the appendString in the last line of all files in the current directory.
   */
  function removeStringFromFileRecursive(path: string, str: string) {
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
      files.forEach((file) => {
        const filePath = path + "/" + file;
        removeStringFromFileRecursive(filePath, str);
      });
    } else if (stat.isFile()) {
      removeStringFromFile(path, str);
    }
  }

  function removeStringFromFile(filePath: string, str: string) {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const lines = fs.readFileSync(filePath, "utf-8").split("\n");
      const lastLine = lines.pop();

      if (lastLine?.includes(str)) {
        const newLine = lastLine.replaceAll(str, "");
        lines.push(newLine);
        fs.writeFileSync(filePath, lines.join("\n"));

        if (showLog) {
          const log = `restore \`${path.basename(filePath)}\` hash, md5: \`${md5File(filePath)}\``;
          setMarkdown((prev) => prev + log + "\n\n");
        }
      }
    }
  }

  useEffect(() => {
    if (markdown === undefined) {
      getSelectedFilePaths().then((paths) => {
        if (paths) {
          paths.forEach((path) => {
            console.log(path.path);
            if (modify) {
              appendStringToFileRecursive(path.path, appendString);
            } else {
              removeStringFromFileRecursive(path.path, appendString);
            }
            const completeLog = `## ${title} has been completed 🎉🎉🎉 \n\n`;
            setMarkdown((prev) => prev + completeLog);
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

  return <Detail markdown={markdown} />;
}

/**
 * Get the md5 hash of a file.
 */
function md5File(filePath: string): string {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  return md5(fileContent);
}

function md5(text: string): string {
  return CryptoJS.MD5(text).toString();
}
