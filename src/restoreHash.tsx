/*
 * @author: tisfeng
 * @createTime: 2022-10-19 21:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-10-19 21:29
 * @fileName: restoreHash.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Detail, getSelectedFinderItems, showToast, Toast } from "@raycast/api";
import fs from "fs";
import { useEffect, useState } from "react";

export default function RestoreHash() {
  console.log("run Restore Hash");
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
   * Remove the appendString in the last line of all files in the current directory.
   */
  function removeStringFromFileRecursive(path: string, appendString = "#1024") {
    const stat = fs.statSync(path);
    if (stat.isFile()) {
      removeStringFromFile(path, appendString);
    } else if (stat.isDirectory()) {
      const files = fs.readdirSync(path);
      files.forEach((file) => {
        const filePath = path + "/" + file;
        removeStringFromFileRecursive(filePath, appendString);
      });
    }
  }

  function removeStringFromFile(filePath: string, appendString = "#1024") {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const log = `restore file hash: ${filePath}`;
      setMarkdown((prev) => prev + log + "\n\n");

      const lines = fs.readFileSync(filePath, "utf-8").split("\n");
      const lastLine = lines.pop();

      // if last line contains appendString, remove it
      if (lastLine?.includes(appendString)) {
        const newLine = lastLine.replaceAll(appendString, "");

        // write to file
        lines.push(newLine);
        fs.writeFileSync(filePath, lines.join("\n"));
      }
    }
  }

  useEffect(() => {
    if (markdown === undefined) {
      setMarkdown("");
      const paths = getSelectedFilesPath();
      paths.then((paths) => {
        if (paths) {
          paths.forEach((path) => {
            console.log(path.path);
            removeStringFromFileRecursive(path.path);
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

  return <Detail markdown={markdown} />;
}
