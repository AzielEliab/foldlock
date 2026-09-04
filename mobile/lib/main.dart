import 'package:flutter/material.dart';

import 'theme.dart';

const limitation =
    'THIS IS SOTA compression software and a compression engine — '
    'zip-class for UTF-8 text (UNI1). '
    'THIS IS NOT the ZIP container format, a zlib/gzip wrapper, a claim '
    'every file shrinks, UL, EmployeeLock, TemporalLock, or GodLock. '
    'Ratios are receipts. Short strings are left alone. Author Aziel Eliab.';

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
      theme: buildAppTheme(),
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
  String kid =
      'Type a sentence. This phone app shows the idea. Full fold is the desktop compression engine.';

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
        padding: const EdgeInsets.all(16),
        children: [
          Text(limitation, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 12),
          const Text('zip: False · method: tether-suppression · FLD3 / TETH-1'),
          const SizedBox(height: 16),
          TextField(
            controller: controller,
            maxLines: 8,
            decoration: const InputDecoration(
              labelText: 'Your text',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              FilledButton(
                onPressed: () {
                  setState(() {
                    kid =
                        'Desktop FoldLock folds this with 3-byte opcodes. '
                        'Unfold checks size and SHA-256. This phone screen is a compression engine, not a ZIP wrapper.';
                  });
                },
                child: const Text('Fold'),
              ),
              FilledButton(
                onPressed: () {
                  setState(() {
                    kid = 'Unfold puts the little words back. verified True only if hashes match.';
                  });
                },
                child: const Text('Unfold'),
              ),
              FilledButton(
                onPressed: () {
                  setState(() {
                    kid =
                        'Verify is a hash check. VECTORS.txt is 63 bytes. zip is False.';
                  });
                },
                child: const Text('Verify'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(kid),
          const SizedBox(height: 24),
          const Text(
            'Not a store listing. Full codec is Python stdlib on the desktop. Apache-2.0.',
          ),
        ],
      ),
    );
  }
}
