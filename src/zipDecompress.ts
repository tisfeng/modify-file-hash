/*
 * @author: tisfeng
 * @createTime: 2022-10-24 18:48
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-10-24 19:12
 * @fileName: zipDecompress.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import RunCommand, { ActionType } from "./utils";

export default function zipDecompress() {
  return RunCommand(ActionType.ZipDecompress);
}
