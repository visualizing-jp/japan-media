# 家計調査の取得

数値は次のファイルだけから組み立てる。`scripts/build_kakei.py` が `series.json` を書く。手入力しない。

## 1963–2007年　二人以上の非農林漁家世帯

- ページ: https://www.stat.go.jp/data/kakei/longtime/index3.html
- ファイル: https://www.stat.go.jp/data/kakei/longtime/zuhyou/20-03-a.xls
- 保存: `data/kakei/raw/20-03-a.xls`
- シート `801-913`。金額は円、1世帯あたり年間。
- 新聞は符号850、書籍は854、放送受信料は合計列。NHK（88A）と他の受信料（880）は2000年以降の行だけ数値がある。ケーブル（88B）は2002年以降。
- 雑誌は1973年以降の「雑誌・週刊誌」（851）。1963–1972年は「雑誌」と「週刊誌」の和。1973–1994年は和と851が一致することをスクリプトが確認する。
- 掲載に使うのは1963–1999年。2000年以降は世帯の範囲が違うので、20-3-b を使う。

## 2000–2010年　二人以上の世帯

- ファイル: https://www.stat.go.jp/data/kakei/longtime/zuhyou/20-03-b.xls
- 保存: `data/kakei/raw/20-03-b.xls`
- 同じシートの新聞、雑誌・週刊誌、書籍、放送受信料、NHK、ケーブル、他の受信料。

## 2011–2014年　年報第4-1表

年報の入口: https://www.stat.go.jp/data/kakei/npsf.html

各年の詳細結果表（二人以上の世帯）から、表番号4-1「全国　二人以上の世帯」の Excel（fileKind=0）。支出金額の列は、消費支出の年間額が小分類の長期系列と一致する列。

| 年 | 一覧 | statInfId |
| --- | --- | --- |
| 2011 | https://www.e-stat.go.jp/stat-search/files?lid=000001086337&layout=datalist | 000012687873 |
| 2012 | https://www.e-stat.go.jp/stat-search/files?lid=000001106710&layout=datalist | 000019023723 |
| 2013 | https://www.e-stat.go.jp/stat-search/files?lid=000001117248&layout=datalist | 000023621378 |
| 2014 | https://www.e-stat.go.jp/stat-search/files?lid=000001129409&layout=datalist | 000028352467 |

保存: `data/kakei/raw/nenpou/4-1-2011.xls` から `4-1-2014.xls`。

2011年の公開（更新）日は2012-08-10。調査員の不正事務に伴う更新と同じ日なので、この現行ファイルを使う。

## 2015年以降　e-Stat 長期時系列

一覧: https://www.e-stat.go.jp/stat-search/files?page=1&layout=datalist&toukei=00200561&tstat=000000330001&cycle=0&tclass1=000001228280&tclass2val=0

品目分類（全品目）の支出金額（年）、CSV（fileKind=1）。

| ファイル | statInfId | 年 |
| --- | --- | --- |
| hinmoku-all-annual-2015.csv | 000040270655 | 2015–2019 |
| hinmoku-all-annual-2020.csv | 000040270656 | 2020–2024 |
| hinmoku-all-annual-2025.csv | 000040409801 | 2025– |

符号 850 新聞、851 雑誌、854 書籍、88A NHK、88B ケーブル、880 他の放送受信料。放送受信料の合計行は内訳の和と一致することをスクリプトが確認する。

## 分類の確認

- https://www.stat.go.jp/data/kakei/2025np/pdf/fr8.pdf を `raw/fr8-2025-classification.pdf` に保存。
- 2025年の公表系列でも新聞は850の一項目。全国紙と地方紙の列はない。
- 改定の案内: https://www.stat.go.jp/data/kakei/change2025.html
- 2018年の調査方法: https://www.stat.go.jp/info/today/140.html
- 正誤: https://www.stat.go.jp/data/seigo/kakei/index.htm

小分類までの長期系列（statInfId 000040270652、`hinmoku-small-annual-2000.csv`）は、新聞が分かれず「書籍・他の印刷物」だけなので、グラフには使わない。単位の確認にだけ使った。
