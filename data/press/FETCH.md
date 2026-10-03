# 新聞発行部数の取得

数値は日本新聞協会のHTML表だけから組み立てる。`scripts/build_press.py` が `series.json` を書く。図表や写真は保存しない。手入力しない。

- 発行部数と世帯数（セットを1部）: https://pressnet.or.jp/data/circulation/circulation01.php
  保存: `data/press/raw/circulation01.html`
  年は1965–2025、各年10月。列は合計、一般紙、スポーツ紙、セット部数、朝刊単独、夕刊単独、1世帯あたり部数、世帯数。
- 発行部数と普及度（セットを2部、単位は千部）: https://pressnet.or.jp/data/circulation/circulation05.php
  保存: `data/press/raw/circulation05.html`
  年は2000–2025。部の系列は千部×1000。2025年の端数は circulation01 の注（28,244,091部）と照合する。
- 戸別配達率: https://pressnet.or.jp/data/circulation/circulation03.php
  保存: `data/press/raw/circulation03.html`
  年は2000–2025。戸別配達、即売、郵送、その他。単位は％。
- 都道府県別（2025年10月の断面）: https://www.pressnet.or.jp/data/circulation/circulation02.html
  保存: `data/press/raw/circulation02.html`
  全国計が circulation01 の2025年合計と一致することだけを確認する。過去年の表はない。

転載は日本新聞協会への連絡が必要、と各ページのフッターにある。
