@echo off
REM GEC Bidding and Tendering Information Inquiry - 开发服务器启动脚本

echo ========================================
echo   GEC 招标信息查询系统
echo   开发服务器启动中...
echo ========================================
echo.

REM 检查是否安装了依赖
if not exist "node_modules\" (
    echo [!] 未检测到 node_modules，正在安装依赖...
    call npm install
    echo.
)

REM 启动开发服务器
echo [*] 启动 Vite 开发服务器...
echo.
echo   访问地址: http://localhost:5173
echo   按 Ctrl+C 停止服务器
echo.
echo ========================================
echo.

npm run dev
