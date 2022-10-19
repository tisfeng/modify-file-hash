/*
 * @author: tisfeng
 * @createTime: 2022-10-19 22:28
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-10-20 00:11
 * @fileName: utils.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Detail, getSelectedFinderItems, showToast, Toast } from "@raycast/api";
import CryptoJS from "crypto-js";
import fs from "fs";
import path from "path";
import { useEffect, useState } from "react";

export const appendString = "#1024";

export default function ModifyHash(modify: boolean) {
  console.log("run ModifyHash: ", modify);

  const [markdown, setMarkdown] = useState<string>();
  const title = modify ? "Modify Hash" : "Restore Hash";

  const getSelectedFilePaths = async () => {
    console.log("getSelectedFilePaths");
    setMarkdown(`# ${title} \n\n ---- \n\n`);

    try {
      const selectedItems = await getSelectedFinderItems();
      if (selectedItems.length === 0) {
        showToast(Toast.Style.Failure, "No file selected");
        return;
      }
      return selectedItems;
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Cannot copy file path",
        message: String(error),
      });
    }
  };

  /**
   * Apppend a string to the end of all files in the current directory.
   */
  function appendStringToFileRecursive(path: string, str: string) {
    const stat = fs.statSync(path);
    if (stat.isFile()) {
      appendStringToFile(path, str);
    } else if (stat.isDirectory()) {
      const subtitle = `## Directory: ${path} \n\n`;
      setMarkdown((prev) => prev + subtitle);

      const files = fs.readdirSync(path);
      files.forEach((file) => {
        const filePath = path + "/" + file;
        appendStringToFileRecursive(filePath, str);
      });
    }
  }

  /**
   * Apppend a string to the end of file.
   */
  function appendStringToFile(filePath: string, str: string) {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const oldMd5 = md5File(filePath);
      const oldMd5Log = `${path.basename(filePath)}, old md5: ${oldMd5}`;
      setMarkdown((prev) => prev + oldMd5Log + "\n\n");

      fs.appendFileSync(filePath, str);

      const newMd5 = md5File(filePath);
      const newMd5Log = `${path.basename(filePath)}, new md5: ${newMd5}`;
      setMarkdown((prev) => prev + newMd5Log + "\n\n");
    } else if (stat.isDirectory()) {
      appendStringToFileRecursive(filePath, str);
    }
  }

  /**
   * Remove the appendString in the last line of all files in the current directory.
   */
  function removeStringFromFileRecursive(path: string, str: string) {
    const stat = fs.statSync(path);
    if (stat.isFile()) {
      removeStringFromFile(path, str);
    } else if (stat.isDirectory()) {
      const subtitle = `## Directory: ${path} \n\n`;
      setMarkdown((prev) => prev + subtitle);

      const files = fs.readdirSync(path);
      files.forEach((file) => {
        const filePath = path + "/" + file;
        removeStringFromFileRecursive(filePath, str);
      });
    }
  }

  function removeStringFromFile(filePath: string, str: string) {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const lines = fs.readFileSync(filePath, "utf-8").split("\n");
      const lastLine = lines.pop();

      // if last line contains appendString, remove it
      if (lastLine?.includes(str)) {
        const newLine = lastLine.replaceAll(str, "");

        // write to file
        lines.push(newLine);
        fs.writeFileSync(filePath, lines.join("\n"));

        const log = `restore ${path.basename(filePath)} hash, md5: ${md5File(filePath)}`;
        setMarkdown((prev) => prev + log + "\n\n");
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
