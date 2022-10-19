/*
 * @author: tisfeng
 * @createTime: 2022-10-19 21:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-10-19 22:58
 * @fileName: restoreHash.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import ModifyHash from "./utils";

export default function RestoreFileHash() {
  console.log("run Restore Hash");

  return ModifyHash(false);
}
