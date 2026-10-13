@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo ============ 1/25 卡牌靶子（平行模拟器） ============
node tools/validate_cards.js
echo.
echo ============ 2/25 真引擎（直接跑 行旅.js） ============
node tools/engine_harness.js
echo.
echo ============ 3/25 盘点：表情差分到位率 / 素材 / 缺口 ============
node tools/inventory.js
echo.
echo ============ 4/25 无头截图（回读 data-screen / data-board / data-clash / data-fault / data-dlg） ============
python tools/shot_game.py
echo.
echo ============ 5/25 同一百六十九屏摆成「这一章玩到中后段」那一格再拍一遍（#章/屏/full） ============
python tools/shot_game.py --full
echo.
echo ============ 6/25 拼一页可双击的总览 ============
python tools/contact_sheet.py
echo.
echo ============ 7/25 印章图文对不对得上（量朱砂，不靠肉眼） ============
python tools/check_seals.py
echo.
echo ============ 8/25 音效实播（真浏览器逐个解码） ============
python tools/check_audio.py
echo.

============ 9/25 授权台账（盘上文件/表行/署名屏，三本账对齐） ============
python tools/check_lic.py
echo ============ 10/25 真机点两遍（通关口径 + 覆盖口径） ============
python tools/check_playthrough.py
echo.
echo ============ 11/25 灶前新玩法（九道菜 · 读帖挡不挡 · 锅活不活 · 催是不是陷阱） ============
node tools/stove_greedy.js
echo.
echo ============ 12/25 灶前五张：四间灶房 + 切过之后的案板 ============
python tools/shot_stove.py
echo.
echo ============ 13/25 匾上的字看不看得见（拿截图像素量对比，不拿素材原件猜） ============
python tools/check_board_contrast.py
echo.
echo ============ 14/25 每屏点名的背景：在不在盘、接没接上高清、比例对不对 ============
python tools/check_bg_ratio.py
echo.
echo ============ 15/25 文案层（引号配对／叠字／占位符没删）—— 只报数不判红 ============
python tools/check_text.py
echo.
echo ============ 16/25 待回校清单与数据对数（引文改了没重跑清单，这里就红） ============
python tools/ssot_pending.py --check
echo.
echo ============ 17/25 时代倒流：某章的引文不许挂着比本章下限还晚的系年（自报命中数） ============
python tools/check_anachronism.py
echo.
echo ============ 18/25 录方可读性（尝出来的方向夹不夹得死方子；贪心机只读界面也要能夹死） ============
node tools/check_recipes.js
echo.
echo ============ 19/25 UI 框被拉扁了几倍（原图比例 vs 盒子比例；变形只报数，改不改眼睛说了算） ============
python tools/check_frame_aspect.py
echo ============ 20/25 两趟全量真收敛了吗（同一批路由在两格状态下都被拍到过） ============
python tools/check_convergence.py
echo ============ 21/25 尝菜那本账簿有没有把底部裁掉（量 data-fit，不靠肉眼） ============
python tools/check_taste_fit.py
echo ============ 22/25 真机上那些锚点挂得上吗（尝菜屏 4 · 对照屏 4 · 成就墙 4）============
python tools/check_anchor_live.py
echo.
pause
echo.
echo ============ 23/25 启动器闸（双击入口的编码/内容——10-03「双击后不能玩」那口锅） ============
python tools/check_launcher.py
echo.
echo ============ 24/25 两趟的图是不是同一张（§46 记下给下一轮的那 22 对白拍 —— 10-08 起有人量了） ============
python tools/check_deep_diff.py
echo.
echo ============ 25/25 可读性与键盘语义（真浏览器 × 四档视口 × 五屏 —— 10-13 审计 A09/A10）============
python tools/check_readability.py

