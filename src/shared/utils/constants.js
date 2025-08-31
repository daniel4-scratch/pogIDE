const { app, BrowserWindow, ipcMain, Menu, dialog, globalShortcut, nativeTheme, clipboard } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require('http');

module.exports = {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    dialog,
    globalShortcut,
    nativeTheme,
    clipboard,
    spawn,
    path,
    fs,
    os,
    http
};
