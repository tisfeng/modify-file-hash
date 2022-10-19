/*
 * @author: tisfeng
 * @createTime: 2022-10-13 19:55
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-10-19 21:02
 * @fileName: index.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Detail, getSelectedFinderItems, showToast, Toast } from "@raycast/api";
import CryptoJS from "crypto-js";
import fs from "fs";
import { useEffect, useState } from "react";

export default function Command() {
  console.log("run Command");
  const [markdown, setMarkdown] = useState<string>();

  const getSelectedFilesPath = async () => {
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
  function appendStringToFilesRecursive(path: string, appendString = "#1024") {
    const files = fs.readdirSync(path);
    files.forEach((file) => {
      const filePath = path + "/" + file;
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        const oldMd5 = md5File(filePath);
        const oldMd5Log = `file: ${file}, old md5: ${oldMd5}`;
        setMarkdown((prev) => prev + oldMd5Log + "\n\n");

        fs.appendFileSync(filePath, appendString);

        const newMd5 = md5File(filePath);
        const newMd5Log = `file: ${file}, new md5: ${newMd5}`;
        setMarkdown((prev) => prev + newMd5Log + "\n\n");
      } else if (stat.isDirectory()) {
        const dirLog = `dir: ${file}`;
        setMarkdown((prev) => prev + dirLog + "\n\n");
        appendStringToFilesRecursive(filePath, appendString);
      }
    });
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

  useEffect(() => {
    if (markdown === undefined) {
      setMarkdown("");
      const paths = getSelectedFilesPath();
      paths.then((paths) => {
        if (paths) {
          paths.forEach((path) => {
            console.log(path.path);
            appendStringToFilesRecursive(path.path);
          });
        }
      });
    }
  }, [markdown]);

  return <Detail markdown={markdown} />;
}
