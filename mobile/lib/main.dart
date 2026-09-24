import 'package:flutter/material.dart';

import 'theme.dart';

const limitation =
    'FoldLock folds UTF-8 text and restores the same bytes when the size '
    'and SHA-256 match. Short text stays the same size. Photos, ZIP archives, '
    'and other already-compressed files are refused. Ratios are per-file '
    'receipts. Author Aziel Eliab.';

const vectors = 'the cat and the dog\n'
    'As is has to and or etc.\n'
    'and and and\n'
    'hello\n';

void main() {
  runApp(const FoldLockApp());
}

class FoldLockApp extends StatelessWidget {
  const FoldLockApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FoldLock',
      debugShowCheckedModeBanner: false,
      theme: buildLightTheme(),
      darkTheme: buildAppTheme(),
      themeMode: ThemeMode.system,
      home: const FoldPage(),
    );
  }
}

class FoldPage extends StatefulWidget {
  const FoldPage({super.key});

  @override
  State<FoldPage> createState() => _FoldPageState();
}

class _FoldPageState extends State<FoldPage> {
  final controller = TextEditingController(text: vectors);
  String status =
      'Paste a sentence, then choose Fold. The fold itself runs in the desktop package.';

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('FoldLock')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Make UTF-8 text smaller when it can, then put the same bytes back.',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: controller,
            maxLines: 8,
            decoration: const InputDecoration(
              labelText: 'Your text',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () {
              setState(() {
                status =
                    'This phone screen does not fold the file. On the desktop package, run: foldlock fold notes.txt';
              });
            },
            child: const Text('Fold'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () {
              setState(() {
                status =
                    'Unfold restores the original bytes when the size and SHA-256 match. Use the desktop package: foldlock unfold notes.txt.fld';
              });
            },
            child: const Text('Unfold'),
          ),
          const SizedBox(height: 16),
          Text(status),
          const SizedBox(height: 12),
          ExpansionTile(
            title: const Text('Advanced'),
            children: [
              ListTile(
                title: const Text('Verify'),
                subtitle: const Text(
                  'Verify checks the size and SHA-256. The sample text is 63 bytes and is left unchanged.',
                ),
                onTap: () {
                  setState(() {
                    status =
                        'Verify checks the size and SHA-256. The sample text is 63 bytes and is left unchanged.';
                  });
                },
              ),
            ],
          ),
          ExpansionTile(
            title: const Text('About'),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Text(limitation),
              ),
              const ListTile(
                title: Text('Author'),
                subtitle: Text('Aziel Eliab · Apache-2.0'),
              ),
              const ListTile(
                title: Text('Receipt'),
                subtitle: Text('zip: False'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
